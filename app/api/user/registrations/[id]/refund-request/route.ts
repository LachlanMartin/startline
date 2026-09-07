import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { idParams } from "@/lib/schemas";
import { daysUntil, parseTiers, refundAmountCents, refundPercentFor } from "@/lib/refund-policy";

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

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }
  const { id } = parsedParams.data;

  const registration = await prisma.registration.findUnique({
    where: { id },
    select: {
      id: true, userId: true, athleteEmail: true, athleteName: true, status: true,
      amountCents: true, platformFeeCents: true,
      refundPercent: true, refundAmountCents: true, refundOutsidePolicy: true,
      event: {
        select: {
          id: true, title: true, eventDate: true,
          refundTiers: true,
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
    // Return the frozen snapshot, not a fresh calculation, so a repeat click shows
    // the same number the athlete was originally quoted.
    return NextResponse.json({
      status: registration.status,
      alreadyRequested: true,
      refundPercent: registration.refundPercent,
      refundAmountCents: registration.refundAmountCents,
      outsidePolicy: registration.refundOutsidePolicy,
    });
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

  // Work out what the policy owes and freeze it onto the row. Snapshotting here
  // means the amount quoted to the athlete in the dialog is the amount the admin
  // later refunds, even if the request sits for a week and the event draws closer.
  const paidCents = registration.amountCents + registration.platformFeeCents;
  const tiers = parseTiers(registration.event.refundTiers);
  const days = daysUntil(registration.event.eventDate, today);
  const percent = refundPercentFor(tiers, days);
  const amount = refundAmountCents(tiers, paidCents, days);

  await prisma.registration.update({
    where: { id },
    data: {
      status: "REFUND_REQUESTED",
      refundPercent: percent,
      refundAmountCents: amount,
      refundRequestedAt: new Date(),
      // A request the policy returns nothing for is still allowed through, but it
      // is flagged so the organiser and admin can see it is discretionary rather
      // than something the athlete is owed.
      refundOutsidePolicy: percent === 0,
    },
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
        // A free entry has no money attached, so it is a cancellation rather than
        // a refund and is described as one (issue #304).
        title: paidCents === 0 ? "Entry cancelled" : "Refund requested",
        body:
          paidCents === 0
            ? `${registration.athleteName} cancelled their free entry to ${registration.event.title}. ` +
              `They have left wave assignment and freed their spot. There is nothing to refund.`
            : `${registration.athleteName} asked for a refund on ${registration.event.title}. ` +
              `They have left wave assignment and freed their spot. ` +
              (percent === 0
                ? "Your policy does not cover a refund at this date, so this is a discretionary request."
                : `Your policy covers ${percent}% of what they paid.`),
        eventId: registration.event.id,
      })),
    });
  } catch {
    // Swallowed on purpose — see above.
  }

  return NextResponse.json({
    status: "REFUND_REQUESTED",
    refundPercent: percent,
    refundAmountCents: amount,
    outsidePolicy: percent === 0,
  });
}
