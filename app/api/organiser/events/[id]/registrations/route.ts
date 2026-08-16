import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrganiserSession } from "@/lib/amplify-server";
import { wavesWithCounts } from "@/lib/start-waves";
import type { RegistrationStatus, Prisma } from "@prisma/client";
import { idParams } from "@/lib/schemas";
import { z } from "zod";

const STATUSES = new Set(["CONFIRMED", "REFUND_REQUESTED", "REFUNDED", "CANCELLED"]);

const registrationPatchRowSchema = z.object({
  registrationId: z.string().min(1).max(255),
  startWaveId: z.string().max(255).nullable().optional(),
  startWaveLabel: z.string().max(255).nullable().optional(),
  bibNumber: z.string().max(50).nullable().optional(),
  status: z.enum(["CONFIRMED", "REFUND_REQUESTED", "REFUNDED", "CANCELLED"]).optional(),
  estimatedFinishMinutes: z.number().int().min(0).nullable().optional(),
});

const registrationPatchSchema = z.object({
  registrations: z.array(registrationPatchRowSchema).min(1),
});

async function assertOwnedEvent(eventId: string, organiserId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, organiserId: true, waves: true, title: true },
  });
  if (!event) return { error: NextResponse.json({ error: "Not found." }, { status: 404 }) };
  if (event.organiserId !== organiserId) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }
  return { event };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;
  const owned = await assertOwnedEvent(id, session.sub);
  if (owned.error) return owned.error;

  const registrations = await prisma.registration.findMany({
    where: { eventId: id },
    orderBy: [{ athleteName: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      athleteName: true,
      athleteEmail: true,
      category: true,
      waveLabel: true,
      startWaveId: true,
      startWaveLabel: true,
      waveNotifiedLabel: true,
      bibNumber: true,
      gender: true,
      dateOfBirth: true,
      estimatedFinishMinutes: true,
      medicalNotes: true,
      status: true,
      checkedInAt: true,
      amountCents: true,
      platformFeeCents: true,
      createdAt: true,
      resultDistance: true,
      resultTime: true,
      resultPlacement: true,
      isPersonalBest: true,
      isTopResult: true,
    },
  });

  const waves = (owned.event!.waves as { label: string; price: string; qty?: number }[]) ?? [];
  const startWaves = await wavesWithCounts(id);

  return NextResponse.json({
    event: {
      id: owned.event!.id,
      title: owned.event!.title,
      waves,
      startWaves,
    },
    registrations: registrations.map((r) => ({
      id: r.id,
      name: r.athleteName,
      email: r.athleteEmail,
      category: r.category,
      waveId: r.startWaveId,
      wave: r.startWaveLabel,
      tier: r.waveLabel,
      waveNotified: r.waveNotifiedLabel,
      bibNumber: r.bibNumber,
      gender: r.gender,
      dateOfBirth: r.dateOfBirth,
      estimatedFinishMinutes: r.estimatedFinishMinutes,
      medicalNotes: r.medicalNotes,
      status: r.status,
      checkedInAt: r.checkedInAt,
      amount: r.amountCents / 100,
      createdAt: r.createdAt,
      resultDistance: r.resultDistance,
      resultTime: r.resultTime,
      resultPlacement: r.resultPlacement,
      isPersonalBest: r.isPersonalBest,
      isTopResult: r.isTopResult,
    })),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;
  const owned = await assertOwnedEvent(id, session.sub);
  if (owned.error) return owned.error;

  const parsedBody = registrationPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "registrations array is required." }, { status: 400 });
  }
  const rows = parsedBody.data.registrations;

  // Resolve wave references against the StartWave table. We accept either an id
  // (preferred) or a label (from older callers) and write both columns in step.
  const startWaves = await prisma.startWave.findMany({
    where: { eventId: id },
    select: { id: true, label: true },
  });
  const idToLabel = new Map(startWaves.map((w) => [w.id, w.label]));
  const labelToId = new Map(startWaves.map((w) => [w.label.toLowerCase(), w.id]));

  const existing = await prisma.registration.findMany({
    where: { eventId: id },
    select: { id: true, bibNumber: true },
  });
  const byId = new Map(existing.map((r) => [r.id, r]));

  // Track bibs after applying this batch so we catch intra-batch collisions.
  const bibOwner = new Map<string, string>();
  for (const r of existing) {
    if (r.bibNumber?.trim()) bibOwner.set(r.bibNumber.trim(), r.id);
  }

  const updates: { id: string; data: Prisma.RegistrationUncheckedUpdateInput }[] = [];
  const unmatched: string[] = [];

  for (const row of rows) {
    if (!row.registrationId || !byId.has(row.registrationId)) {
      unmatched.push(row.registrationId ?? "unknown");
      continue;
    }

    const data: Prisma.RegistrationUncheckedUpdateInput = {};

    if ("startWaveId" in row) {
      const wid = row.startWaveId?.trim() || null;
      if (wid && !idToLabel.has(wid)) {
        return NextResponse.json({ error: "Unknown start wave." }, { status: 400 });
      }
      data.startWaveId = wid;
      data.startWaveLabel = wid ? idToLabel.get(wid)! : null;
    } else if ("startWaveLabel" in row) {
      const label = row.startWaveLabel?.trim() || null;
      if (label && !labelToId.has(label.toLowerCase())) {
        return NextResponse.json({ error: `Unknown start wave "${label}".` }, { status: 400 });
      }
      data.startWaveId = label ? labelToId.get(label.toLowerCase())! : null;
      data.startWaveLabel = label ? idToLabel.get(labelToId.get(label.toLowerCase())!)! : null;
    }

    if ("bibNumber" in row) {
      const bib = row.bibNumber?.trim() || null;
      if (bib) {
        const owner = bibOwner.get(bib);
        if (owner && owner !== row.registrationId) {
          return NextResponse.json(
            { error: `Bib ${bib} is already assigned.` },
            { status: 409 }
          );
        }
        // Release previous bib for this registration in the map
        for (const [b, ownerId] of bibOwner) {
          if (ownerId === row.registrationId) bibOwner.delete(b);
        }
        bibOwner.set(bib, row.registrationId);
      } else {
        for (const [b, ownerId] of bibOwner) {
          if (ownerId === row.registrationId) bibOwner.delete(b);
        }
      }
      data.bibNumber = bib;
    }

    if ("status" in row && row.status != null) {
      if (!STATUSES.has(row.status)) {
        return NextResponse.json({ error: `Invalid status "${row.status}".` }, { status: 400 });
      }
      data.status = row.status as RegistrationStatus;
    }

    if ("estimatedFinishMinutes" in row) {
      const mins = row.estimatedFinishMinutes;
      if (mins != null && (!Number.isInteger(mins) || mins < 0)) {
        return NextResponse.json({ error: "estimatedFinishMinutes must be a non-negative integer." }, { status: 400 });
      }
      data.estimatedFinishMinutes = mins ?? null;
    }

    if (Object.keys(data).length === 0) continue;
    updates.push({ id: row.registrationId, data });
  }

  if (updates.length > 0) {
    await prisma.$transaction(
      updates.map((u) => prisma.registration.update({ where: { id: u.id }, data: u.data }))
    );
  }

  return NextResponse.json({ updated: updates.length, unmatched });
}
