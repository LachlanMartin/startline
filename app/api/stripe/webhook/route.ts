import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { parseParticipantsFromMetadata } from "@/lib/stripe-webhook";
import { calculateTotalWithFee } from "@/lib/platform-fee";
import {
  announceRegistrations,
  ensureParticipantUsers,
  insertConfirmedRegistrations,
  type PricedEntry,
} from "@/lib/registration-confirm";
import { athleteNameFromParticipant, type CompactParticipant } from "@/lib/registration-form";

function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  return secret;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature") ?? "";

    const stripe = getStripe();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, getWebhookSecret());
    } catch {
      return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
    }

    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const meta = paymentIntent.metadata;
  const eventId = meta.eventId;
  const organiserId = meta.organiserId;

  if (!eventId || !organiserId) {
    console.error("Missing metadata on PaymentIntent:", paymentIntent.id);
    return;
  }

  const existingCount = await prisma.registration.count({
    where: { stripePaymentIntentId: paymentIntent.id },
  });
  if (existingCount > 0) return;

  const participants = parseParticipantsFromMetadata(meta);

  // Re-derive everything from the DB — metadata on a PaymentIntent is
  // client-influenced (the publishable key can create intents with arbitrary
  // metadata), so it must never be trusted for pricing or identity.
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true, title: true, status: true, feeStructure: true, registrationType: true,
      waves: true, cap: true, eventDate: true, startTime: true, venue: true, city: true, state: true,
      organiserId: true,
    },
  });

  // Reject intents that don't match a real, approved, self-hosted event.
  if (!event || event.organiserId !== organiserId) {
    console.error("PaymentIntent references an unknown/mismatched event:", paymentIntent.id);
    return;
  }
  if (event.status !== "APPROVED" || event.registrationType !== "startline") {
    console.error("PaymentIntent references a non-bookable event:", paymentIntent.id);
    return;
  }

  if (participants.length === 0) {
    console.error("No participant data on PaymentIntent:", paymentIntent.id);
    await prisma.registration.create({
      data: {
        eventId,
        organiserId,
        athleteName: meta.userName ?? "Unknown",
        athleteEmail: meta.userEmail ?? "",
        amountCents: 0,
        platformFeeCents: 0,
        feeStructure: event.feeStructure,
        status: "CANCELLED",
        stripePaymentIntentId: paymentIntent.id,
      },
    });
    return;
  }

  // Price every ticket from the DB wave definitions — never from metadata. A
  // free tier is priced at zero rather than rejected, so a mixed cart (a free
  // tier alongside a paid one) confirms with the right amount on each entry.
  const waves = Array.isArray(event.waves)
    ? event.waves as { label: string; price: string; qty?: number }[]
    : [];
  const waveOf = (participant: CompactParticipant) => participant.wav || meta.waveLabel || null;
  const priceEntry = (participant: CompactParticipant): PricedEntry | null => {
    const label = waveOf(participant);
    const wave = label ? waves.find((w) => w.label === label) : undefined;
    if (!wave) return null;
    const priceCents = Math.round(parseFloat(wave.price || "0") * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) return null;
    const { platformFeeCents } = calculateTotalWithFee(priceCents, event.feeStructure);
    return { participant, waveLabel: label, priceCents, platformFeeCents };
  };

  const priced = participants.map(priceEntry);

  const recordCancelled = () =>
    prisma.registration.createMany({
      data: participants.map((participant) => ({
        eventId,
        organiserId,
        athleteName: athleteNameFromParticipant(participant),
        athleteEmail: participant.em,
        amountCents: 0,
        platformFeeCents: 0,
        feeStructure: event.feeStructure,
        status: "CANCELLED" as const,
        stripePaymentIntentId: paymentIntent.id,
      })),
    });

  // The charged amount must match what the DB pricing implies. Stripe reports
  // amount_received in the minor currency unit, same as our cents.
  const expectedTotalCents = priced.reduce((sum, entry) => {
    if (!entry) return sum;
    return sum + (event.feeStructure === "athlete"
      ? entry.priceCents + entry.platformFeeCents
      : entry.priceCents);
  }, 0);

  if (paymentIntent.amount_received !== expectedTotalCents || priced.some((entry) => !entry)) {
    console.error("PaymentIntent amount does not match DB pricing:", paymentIntent.id,
      { expectedTotalCents, amountReceived: paymentIntent.amount_received });
    await recordCancelled();
    return;
  }

  const entries = priced as PricedEntry[];

  // For guest participants (no userId in metadata), create Cognito accounts +
  // Prisma Users up front so the confirmations below can link them.
  const buyerUserId = meta.userId || "";
  const userIdByEmail = buyerUserId ? {} : await ensureParticipantUsers(entries);

  const outcome = await insertConfirmedRegistrations({
    event,
    organiserId,
    entries,
    buyerUserId,
    userIdByEmail,
    stripePaymentIntentId: paymentIntent.id,
  });

  if (!outcome.ok) {
    console.error("Confirmation refused:", paymentIntent.id, outcome.error);
    await recordCancelled();
    return;
  }

  await announceRegistrations(event, organiserId, entries);
}

async function handleAccountUpdated(account: Stripe.Account) {
  const chargesEnabled = account.charges_enabled ?? false;
  const payoutsEnabled = account.payouts_enabled ?? false;

  if (chargesEnabled && payoutsEnabled) {
    await prisma.organiser.updateMany({
      where: { stripeAccountId: account.id, stripeOnboardingComplete: false },
      data: { stripeOnboardingComplete: true },
    });
  }
}
