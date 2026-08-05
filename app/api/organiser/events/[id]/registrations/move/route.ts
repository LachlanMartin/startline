import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrganiserSession } from "@/lib/amplify-server";
import { CAPACITY_COUNTING_STATUSES } from "@/lib/registration-status";

interface MoveBody {
  registrationIds?: string[];
  /** Destination wave id, or null to move athletes out of any wave. */
  destWaveId?: string | null;
}

// POST — move a set of athletes into one start wave (or out, with destWaveId null)
// in a single transaction. Exceeding the destination's capacity warns but never
// blocks: organisers do this under time pressure and sometimes must overfill.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, organiserId: true },
  });
  if (!event) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (event.organiserId !== session.sub) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as MoveBody | null;
  const ids = Array.isArray(body?.registrationIds) ? body!.registrationIds.filter(Boolean) : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "registrationIds is required." }, { status: 400 });
  }
  const destWaveId = body?.destWaveId ?? null;

  // Resolve the destination wave (label + capacity), scoped to this event.
  let destLabel: string | null = null;
  let destCapacity: number | null = null;
  if (destWaveId !== null) {
    const wave = await prisma.startWave.findUnique({
      where: { id: destWaveId },
      select: { id: true, eventId: true, label: true, capacity: true },
    });
    if (!wave || wave.eventId !== id) {
      return NextResponse.json({ error: "Unknown destination wave." }, { status: 400 });
    }
    destLabel = wave.label;
    destCapacity = wave.capacity;
  }

  // Only touch registrations that actually belong to this event.
  const owned = await prisma.registration.findMany({
    where: { id: { in: ids }, eventId: id },
    select: { id: true },
  });
  const ownedIds = owned.map((r) => r.id);
  const unmatched = ids.filter((rid) => !ownedIds.includes(rid));

  let moved = 0;
  if (ownedIds.length > 0) {
    const res = await prisma.$transaction(async (tx) =>
      tx.registration.updateMany({
        where: { id: { in: ownedIds }, eventId: id },
        data: { startWaveId: destWaveId, startWaveLabel: destLabel },
      }),
    );
    moved = res.count;
  }

  // Recompute the destination's occupancy from the source of truth so the
  // over-capacity signal matches every other capacity consumer.
  let assigned = 0;
  let overCapacity = false;
  if (destWaveId !== null) {
    assigned = await prisma.registration.count({
      where: { eventId: id, startWaveId: destWaveId, status: { in: CAPACITY_COUNTING_STATUSES } },
    });
    overCapacity = destCapacity != null && assigned > destCapacity;
  }

  return NextResponse.json({
    moved,
    unmatched,
    destWave: destWaveId === null ? null : { id: destWaveId, label: destLabel, assigned, capacity: destCapacity, overCapacity },
  });
}
