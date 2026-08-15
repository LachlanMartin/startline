import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrganiserSession } from "@/lib/amplify-server";
import { sendWaveUpdateEmail } from "@/lib/email";
import { idParams } from "@/lib/schemas";

type Wave = { label: string; startTime?: string };

async function assertOwnedEvent(eventId: string, organiserId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, organiserId: true, title: true, eventDate: true, startTime: true, startWaves: true },
  });
  if (!event) return { error: NextResponse.json({ error: "Not found." }, { status: 404 }) };
  if (event.organiserId !== organiserId) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }
  return { event };
}

// POST — notify confirmed athletes whose wave changed since they were last told.
// Wave edits themselves are silent; this is the deliberate, opt-in announce so
// organisers can reshuffle waves freely without spamming athletes. Only athletes
// whose current wave differs from what they last received are messaged.
export async function POST(
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
  const event = owned.event!;

  const waves = (event.startWaves as Wave[]) ?? [];
  const waveTime = (label: string) =>
    waves.find((w) => w.label === label)?.startTime?.trim() || event.startTime || null;

  // Candidates: confirmed athletes who currently have a start wave. Prisma can't
  // compare one column to another, so we fetch and filter for genuinely-changed rows.
  const candidates = await prisma.registration.findMany({
    where: { eventId: id, status: "CONFIRMED", startWaveLabel: { not: null } },
    select: {
      id: true, userId: true, athleteName: true, athleteEmail: true,
      startWaveLabel: true, waveNotifiedLabel: true,
    },
  });
  const changed = candidates.filter((r) => r.startWaveLabel !== r.waveNotifiedLabel);

  if (changed.length === 0) {
    return NextResponse.json({ notified: 0, inApp: 0, emailed: 0 });
  }

  const inAppRows = changed
    .filter((r) => r.userId)
    .map((r) => ({
      userId: r.userId!,
      type: "WAVE_UPDATE" as const,
      title: `Start wave: ${r.startWaveLabel}`,
      body: `You're in the ${r.startWaveLabel} wave for ${event.title}.` +
        (waveTime(r.startWaveLabel!) ? ` Starts ${waveTime(r.startWaveLabel!)}.` : ""),
      eventId: id,
    }));

  // Record in-app notifications and advance each athlete's last-notified marker
  // atomically, so a re-send only ever reaches people who changed again.
  await prisma.$transaction([
    ...(inAppRows.length ? [prisma.userNotification.createMany({ data: inAppRows })] : []),
    ...changed.map((r) =>
      prisma.registration.update({
        where: { id: r.id },
        data: { waveNotifiedLabel: r.startWaveLabel },
      }),
    ),
  ]);

  // Best-effort email; a mail failure must never fail the request or the record.
  let emailed = 0;
  await Promise.all(
    changed.map(async (r) => {
      try {
        await sendWaveUpdateEmail(r.athleteEmail, {
          athleteName: r.athleteName,
          eventTitle: event.title,
          eventId: id,
          waveLabel: r.startWaveLabel!,
          waveTime: waveTime(r.startWaveLabel!),
          eventDate: event.eventDate,
        });
        emailed += 1;
      } catch {
        /* swallow — the in-app notification is already recorded */
      }
    }),
  );

  return NextResponse.json({ notified: changed.length, inApp: inAppRows.length, emailed });
}
