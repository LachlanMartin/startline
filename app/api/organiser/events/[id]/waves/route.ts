import { NextRequest, NextResponse } from "next/server";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { sanitizeWaveInput, wavesWithCounts } from "@/lib/start-waves";
import { idParams } from "@/lib/schemas";
import { z } from "zod";

const wavePatchSchema = z.object({ startWaves: z.unknown().optional() });

async function assertOwnedEvent(eventId: string, organiserId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, organiserId: true },
  });
  if (!event) return { error: NextResponse.json({ error: "Not found." }, { status: 404 }) };
  if (event.organiserId !== organiserId) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }
  return { event };
}

// GET — the event's start waves with live assigned counts.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;
  const owned = await assertOwnedEvent(id, session.sub);
  if (owned.error) return owned.error;

  return NextResponse.json({ startWaves: await wavesWithCounts(id) });
}

// PATCH — replace the event's start waves. Body: { startWaves: WaveDef[] }.
// Reconciles against the StartWave table by id: rows present are updated, new
// ones created, missing ones deleted. The denormalised Registration.startWaveLabel
// is kept in sync (renames follow, deletes clear it), and the legacy
// Event.startWaves JSON is mirrored so not-yet-migrated readers keep working.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;
  const owned = await assertOwnedEvent(id, session.sub);
  if (owned.error) return owned.error;

  const parsedBody = wavePatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const sanitized = sanitizeWaveInput(parsedBody.data.startWaves);
  if (!Array.isArray(sanitized)) {
    return NextResponse.json({ error: sanitized.error }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.startWave.findMany({
        where: { eventId: id },
        select: { id: true, label: true },
      });
      const existingById = new Map(existing.map((w) => [w.id, w]));
      const incomingIds = new Set(sanitized.map((w) => w.id));

      // Delete waves no longer present; clear the label on their registrations first
      // (while the FK is still set — the delete then SetNulls startWaveId).
      const delIds = existing.filter((w) => !incomingIds.has(w.id)).map((w) => w.id);
      if (delIds.length) {
        await tx.registration.updateMany({
          where: { startWaveId: { in: delIds } },
          data: { startWaveLabel: null },
        });
        await tx.startWave.deleteMany({ where: { id: { in: delIds } } });
      }

      const finalWaves = [];
      for (let i = 0; i < sanitized.length; i++) {
        const w = sanitized[i];
        const data = {
          label: w.label,
          startTime: w.startTime ?? null,
          capacity: w.capacity ?? null,
          finishMin: w.finishMin ?? null,
          finishMax: w.finishMax ?? null,
          genders: w.genders ?? [],
          ageMin: w.ageMin ?? null,
          ageMax: w.ageMax ?? null,
          sortOrder: i,
        };
        const prior = existingById.get(w.id);
        if (prior) {
          const row = await tx.startWave.update({ where: { id: w.id }, data });
          if (prior.label !== w.label) {
            await tx.registration.updateMany({
              where: { startWaveId: w.id },
              data: { startWaveLabel: w.label },
            });
          }
          finalWaves.push(row);
        } else {
          finalWaves.push(await tx.startWave.create({ data: { eventId: id, ...data } }));
        }
      }

      const jsonMirror = finalWaves.map((w) => ({
        id: w.id,
        label: w.label,
        startTime: w.startTime ?? undefined,
        capacity: w.capacity,
        finishMin: w.finishMin,
        finishMax: w.finishMax,
        genders: w.genders,
        ageMin: w.ageMin,
        ageMax: w.ageMax,
      }));
      await tx.event.update({ where: { id }, data: { startWaves: jsonMirror } });
    });
  } catch (err) {
    // A label collision (e.g. two waves swapping names in one save) trips the
    // (eventId, label) unique index. Surface it cleanly rather than as a 500.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "Two waves can't share a name." }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ startWaves: await wavesWithCounts(id) });
}
