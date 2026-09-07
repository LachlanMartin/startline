import { NextRequest, NextResponse } from "next/server";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import {
  exportRowsToCsv,
  mapAndSortExportRows,
  parseExportColumns,
  safeExportFilename,
  type ExportRegistrationInput,
} from "@/lib/registration-export";
import { buildRegistrationsXlsx } from "@/lib/registration-export-xlsx";
import { buildStartListPdf } from "@/lib/registration-export-pdf";
import { idParams } from "@/lib/schemas";
import { z } from "zod";

const exportQuery = z.object({
  format: z.enum(["xlsx", "pdf", "csv"]).catch("xlsx"),
  columns: z.string().max(500).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;
  const { format, columns: columnsParam } = exportQuery.parse(
    Object.fromEntries(req.nextUrl.searchParams),
  );
  const columns = parseExportColumns(columnsParam ?? null);

  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      organiserId: true,
      title: true,
      eventDate: true,
      startTime: true,
      venue: true,
      city: true,
      state: true,
    },
  });
  if (!event) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (event.organiserId !== session.sub) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const registrations = await prisma.registration.findMany({
    where: { eventId: id },
    select: {
      id: true,
      athleteName: true,
      athleteEmail: true,
      mobile: true,
      bibNumber: true,
      startWaveLabel: true,
      waveLabel: true,
      category: true,
      gender: true,
      dateOfBirth: true,
      status: true,
      amountCents: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      medicalNotes: true,
      resultDistance: true,
      resultTime: true,
      resultPlacement: true,
      startWave: {
        select: { label: true, startTime: true },
      },
    },
  });

  const inputs: ExportRegistrationInput[] = registrations.map((r) => ({
    id: r.id,
    athleteName: r.athleteName,
    athleteEmail: r.athleteEmail,
    mobile: r.mobile,
    bibNumber: r.bibNumber,
    startWaveLabel: r.startWave?.label ?? r.startWaveLabel,
    startWaveStartTime:
      r.startWave || r.startWaveLabel
        ? (r.startWave?.startTime ?? event.startTime)
        : null,
    waveLabel: r.waveLabel,
    category: r.category,
    gender: r.gender,
    dateOfBirth: r.dateOfBirth,
    status: r.status,
    amountCents: r.amountCents,
    emergencyContactName: r.emergencyContactName,
    emergencyContactPhone: r.emergencyContactPhone,
    medicalNotes: r.medicalNotes,
    resultDistance: r.resultDistance,
    resultTime: r.resultTime,
    resultPlacement: r.resultPlacement,
  }));

  const rows = mapAndSortExportRows(inputs);
  const safeTitle = safeExportFilename(event.title);

  if (format === "pdf") {
    const pdf = await buildStartListPdf({
      eventTitle: event.title,
      eventDate: event.eventDate,
      venue: event.venue,
      city: event.city,
      state: event.state,
      rows,
    });
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeTitle}-start-list.pdf"`,
      },
    });
  }

  if (format === "csv") {
    const csv = exportRowsToCsv(rows, columns);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeTitle}-registrations.csv"`,
      },
    });
  }

  const xlsx = await buildRegistrationsXlsx({
    eventTitle: event.title,
    rows,
    columns,
  });
  return new NextResponse(new Uint8Array(xlsx), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeTitle}-registrations.xlsx"`,
    },
  });
}
