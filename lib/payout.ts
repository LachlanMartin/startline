import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export type PayoutEligibleEvent = {
  id: string;
  title: string;
  eventDate: string;
  endDate: string | null;
  organiser: { id: string; orgName: string | null; stripeAccountId: string | null };
  netCents: number;
};

/**
 * Events whose payout can be run today: the event has finished, the organiser
 * has an onboarded Stripe Express account, and we haven't already paid them.
 */
export async function getPayoutEligibleEvents(): Promise<PayoutEligibleEvent[]> {
  const today = new Date().toISOString().split("T")[0];

  const events = await prisma.event.findMany({
    where: {
      registrationType: "startline",
      payoutTriggered: false,
      organiser: { stripeOnboardingComplete: true, stripeAccountId: { not: null } },
      OR: [
        { endDate: { not: null, lt: today } },
        { endDate: null, eventDate: { lt: today } },
      ],
    },
    select: {
      id: true, title: true, eventDate: true, endDate: true,
      organiser: { select: { id: true, orgName: true, stripeAccountId: true } },
      registrations: {
        where: { status: "CONFIRMED" },
        select: { amountCents: true },
      },
    },
  });

  return events
    .map((event) => {
      const netCents = event.registrations.reduce(
        (sum, registration) => sum + registration.amountCents,
        0
      );
      return { ...event, registrations: undefined, netCents };
    })
    .filter((event) => event.netCents > 0);
}

/**
 * Push the organiser's full net earnings for an event from their Stripe
 * Express balance to their nominated bank account, then mark the event paid.
 * The platform fee was already withheld at charge time (application_fee_amount),
 * so the payout amount is simply the sum of confirmed ticket amounts.
 */
export async function runPayoutForEvent(eventId: string): Promise<{ netCents: number }> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true, title: true, payoutTriggered: true,
      organiser: { select: { id: true, stripeAccountId: true } },
      registrations: {
        where: { status: "CONFIRMED" },
        select: { amountCents: true },
      },
    },
  });

  if (!event) throw new Error("Event not found.");
  if (event.payoutTriggered) throw new Error("Payout already triggered for this event.");
  if (!event.organiser.stripeAccountId) throw new Error("Organiser has no Stripe account.");

  const netCents = event.registrations.reduce(
    (sum, registration) => sum + registration.amountCents,
    0
  );
  if (netCents <= 0) throw new Error("No confirmed registrations to pay out.");

  await getStripe().payouts.create(
    { amount: netCents, currency: "aud" },
    { stripeAccount: event.organiser.stripeAccountId }
  );

  await prisma.event.update({
    where: { id: eventId },
    data: { payoutTriggered: true, payoutAmountCents: netCents, payoutAt: new Date() },
  });

  return { netCents };
}
