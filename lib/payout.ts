import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

/**
 * Add-on rows whose money belongs to the organiser at payout time.
 *
 * PURCHASED only. REFUNDED money has gone back to the athlete, and
 * REFUND_REQUESTED is undecided, so paying it out and then having the organiser
 * approve the refund would reverse a transfer against a balance that had already
 * been swept to their bank. This mirrors how entries count only CONFIRMED.
 */
const PAYOUT_ADDON_STATUSES = ["PURCHASED"] as const;

/**
 * The organiser's share of one event: confirmed entry prices plus purchased
 * add-on prices. Both are the pre-fee amounts, because the Startline fee was
 * already withheld at charge time as application_fee_amount.
 *
 * Merchandise money sits in the organiser's connected balance exactly like
 * ticket money. If it were left out of this sum it would simply never reach
 * their bank account.
 */
function netCentsFor(event: {
  registrations: { amountCents: number }[];
  addOnPurchases: { amountCents: number }[];
}): number {
  const entryCents = event.registrations.reduce((sum, r) => sum + r.amountCents, 0);
  const addOnCents = event.addOnPurchases.reduce((sum, a) => sum + a.amountCents, 0);
  return entryCents + addOnCents;
}

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
      addOnPurchases: {
        where: { status: { in: [...PAYOUT_ADDON_STATUSES] } },
        select: { amountCents: true },
      },
    },
  });

  return events
    .map((event) => ({
      ...event,
      registrations: undefined,
      addOnPurchases: undefined,
      netCents: netCentsFor(event),
    }))
    .filter((event) => event.netCents > 0);
}

/**
 * Push the organiser's full net earnings for an event from their Stripe
 * Express balance to their nominated bank account, then mark the event paid.
 * The platform fee was already withheld at charge time (application_fee_amount),
 * so the payout amount is the sum of confirmed ticket amounts plus purchased
 * add-on amounts.
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
      addOnPurchases: {
        where: { status: { in: [...PAYOUT_ADDON_STATUSES] } },
        select: { amountCents: true },
      },
    },
  });

  if (!event) throw new Error("Event not found.");
  if (event.payoutTriggered) throw new Error("Payout already triggered for this event.");
  if (!event.organiser.stripeAccountId) throw new Error("Organiser has no Stripe account.");

  const netCents = netCentsFor(event);
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
