import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";

// POST — the signed-in athlete asks for a refund on their own registration.
// This does not move any money: it flags the entry so the organiser sees it in
// their Refunds tab and an admin can process the Stripe refund. Idempotent, so a
// double click (or a jumpy connection) never errors.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;

  const registration = await prisma.registration.findUnique({
    where: { id },
    select: {
      id: true, userId: true, athleteEmail: true, athleteName: true, status: true,
      event: {
        select: {
          id: true, title: true, eventDate: true,
          organiser: { select: { id: true } },
        },
      },
    },
  });

  // Scope strictly to the caller's own entry — by user link or matching email.
  const isOwner =
    !!registration &&
    (registration.userId === session.sub ||
      registration.athleteEmail.toLowerCase() === session.email.toLowerCase());
  if (!registration || !isOwner) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }

  if (registration.status === "REFUND_REQUESTED") {
    return NextResponse.json({ status: registration.status, alreadyRequested: true });
  }
  if (registration.status !== "CONFIRMED") {
    return NextResponse.json(
      { error: "Only a confirmed registration can be refunded." },
      { status: 409 },
    );
  }

  // Once the race has been run there is nothing to refund — the spot was used.
  // eventDate is a plain ISO date, so compare on date alone: a request on race
  // day itself is still allowed.
  const today = new Date().toISOString().slice(0, 10);
  if (registration.event.eventDate < today) {
    return NextResponse.json(
      { error: "This event has already taken place, so it can no longer be refunded." },
      { status: 409 },
    );
  }

  await prisma.registration.update({
    where: { id },
    data: { status: "REFUND_REQUESTED" },
  });

  // Tell every member of the organiser in-app. Best-effort: the refund flag is
  // what matters, so a notification failure must never fail the athlete's request.
  try {
    const memberIds = await prisma.organiserMember.findMany({
      where:  { organiserId: registration.event.organiser.id },
      select: { userId: true },
    });
    await prisma.userNotification.createMany({
      data: memberIds.map((m) => ({
        userId: m.userId,
        type: "ORGANISER_REFUND_REQUEST" as const,
        title: "Refund requested",
        body: `${registration.athleteName} asked for a refund on ${registration.event.title}. They have left wave assignment and freed their spot.`,
        eventId: registration.event.id,
      })),
    });
  } catch {
    // Swallowed on purpose — see above.
  }

  return NextResponse.json({ status: "REFUND_REQUESTED" });
}
