import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { idParams } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/**
 * Live ticket availability for an event's registration page: the event cap and
 * confirmed (paid) counts, both overall and per tier. Mirrors the server-side
 * capacity guard in /api/checkout so the client can show sold-out tiers and
 * stop the buyer before they fill out a form for tickets that no longer exist.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }
  const { id } = parsedParams.data;

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, cap: true, waves: true, status: true, registrationType: true },
  });

  if (!event || event.status !== "APPROVED" || event.registrationType !== "startline") {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }

  const confirmedWhere = { eventId: id, status: "CONFIRMED" as const };
  const [confirmed, grouped] = await Promise.all([
    prisma.registration.count({ where: confirmedWhere }),
    prisma.registration.groupBy({
      by: ["waveLabel"],
      where: confirmedWhere,
      _count: { _all: true },
    }),
  ]);

  const confirmedByWave: Record<string, number> = {};
  for (const row of grouped) {
    if (row.waveLabel) confirmedByWave[row.waveLabel] = row._count._all;
  }

  const waves = (event.waves as { label: string; qty?: number }[] | null) ?? [];

  return NextResponse.json({
    cap: event.cap,
    confirmed,
    waves: waves.map((w) => ({
      label: w.label,
      qty: typeof w.qty === "number" ? w.qty : null,
      confirmed: confirmedByWave[w.label] ?? 0,
    })),
  });
}
