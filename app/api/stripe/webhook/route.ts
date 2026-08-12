import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { sendRegistrationConfirmationEmail } from "@/lib/email";
import { parseParticipantsFromMetadata } from "@/lib/stripe-webhook";
import { calculateTotalWithFee } from "@/lib/platform-fee";
import { getCapacityError, hasCappedWave } from "@/lib/registration-capacity";
import {
  expandCompactParticipant,
  athleteNameFromParticipant,
  type CompactParticipant,
} from "@/lib/registration-form";
import { ensureAthleteCognitoUser } from "@/lib/athlete-accounts";

const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;

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

async function ensureGuestUser(email: string, name: string): Promise<string> {
  let cognitoSub: string | null = null;
  try {
    cognitoSub = await ensureAthleteCognitoUser(email);
  } catch (err) {
    console.error(`Cognito creation failed for ${email}:`, err);
  }
  const user = await prisma.user.upsert({
    where: { email },
    update: { ...(cognitoSub && { cognitoSub }), name: name || undefined },
    create: { email, name: name || undefined, ...(cognitoSub ? { cognitoSub } : {}) },
  });
  return user.id;
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

  // Price every ticket from the DB wave definitions — never from metadata.
  const waves = Array.isArray(event.waves)
    ? event.waves as { label: string; price: string; qty?: number }[]
    : [];
  const waveOf = (participant: CompactParticipant) => participant.wav || meta.waveLabel || null;
  const priceOf = (participant: CompactParticipant): { priceCents: number; platformFeeCents: number } | null => {
    const label = waveOf(participant);
    const wave = label ? waves.find((w) => w.label === label) : undefined;
    if (!wave) return null;
    const priceCents = Math.round(parseFloat(wave.price || "0") * 100);
    if (priceCents <= 0) return null;
    const { platformFeeCents } = calculateTotalWithFee(priceCents, event.feeStructure);
    return { priceCents, platformFeeCents };
  };

  const priced = participants.map((participant) => ({
    participant,
    pricing: priceOf(participant),
  }));

  // The charged amount must match what the DB pricing implies. Stripe reports
  // amount_received in the minor currency unit, same as our cents.
  const expectedTotalCents = priced.reduce((sum, { participant, pricing }) => {
    if (!pricing) return sum;
    return sum + (event.feeStructure === "athlete"
      ? pricing.priceCents + pricing.platformFeeCents
      : pricing.priceCents);
  }, 0);

  if (paymentIntent.amount_received !== expectedTotalCents || priced.some(({ pricing }) => !pricing)) {
    console.error("PaymentIntent amount does not match DB pricing:", paymentIntent.id,
      { expectedTotalCents, amountReceived: paymentIntent.amount_received });
    await prisma.registration.createMany({
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
    return;
  }

  // For guest participants (no userId in metadata), create Cognito accounts +
  // Prisma Users up front so the confirmations below can link them.
  const existingUserId = meta.userId || "";
  const userIdByEmail: Record<string, string> = {};
  if (!existingUserId) {
    for (const participant of participants) {
      const email = participant.em?.toLowerCase().trim();
      if (!email) continue;
      const name = athleteNameFromParticipant(participant);
      const uid = await ensureGuestUser(email, name);
      if (uid) userIdByEmail[email] = uid;
    }
  }

  // Atomic capacity check — refuse to confirm past the event cap or a tier's
  // quantity. Runs inside the same transaction as the insert so concurrent
  // confirmations can't both pass the count.
  const capacityViolation = await prisma.$transaction(async (tx) => {
    const requestedByWave = priced.reduce<Record<string, number>>((acc, { participant }) => {
      const label = waveOf(participant);
      if (label) acc[label] = (acc[label] ?? 0) + 1;
      return acc;
    }, {});
    const usedLabels = Object.keys(requestedByWave);
    const needsCapCheck = event.cap != null;
    const needsWaveCheck = hasCappedWave(waves, usedLabels);
    const confirmedTotal = needsCapCheck
      ? await tx.registration.count({ where: { eventId, status: "CONFIRMED" } })
      : 0;
    const confirmedByWave: Record<string, number> = {};
    if (needsWaveCheck) {
      const grouped = await tx.registration.groupBy({
        by: ["waveLabel"],
        where: { eventId, status: "CONFIRMED" },
        _count: { _all: true },
      });
      for (const row of grouped) {
        if (row.waveLabel) confirmedByWave[row.waveLabel] = row._count._all;
      }
    }
    const capacityError = getCapacityError({
      cap: event.cap,
      confirmedTotal,
      requestedTotal: participants.length,
      waves,
      usedLabels,
      confirmedByWave,
      requestedByWave,
    });
    if (capacityError) return capacityError;
    await tx.registration.createMany({
      data: priced.map(({ participant, pricing }) => {
        const expanded = expandCompactParticipant(participant);
        const email = participant.em?.toLowerCase().trim() || "";
        const uid = existingUserId || userIdByEmail[email] || "";
        return {
          eventId,
          organiserId,
          userId: uid || null,
          athleteName: athleteNameFromParticipant(participant),
          athleteEmail: participant.em,
          firstName: expanded.firstName,
          lastName: expanded.lastName,
          dateOfBirth: expanded.dateOfBirth,
          gender: expanded.gender || null,
          mobile: expanded.mobile,
          emergencyContactName: expanded.emergencyContactName,
          emergencyContactPhone: expanded.emergencyContactPhone,
          medicalNotes: expanded.medicalNotes || null,
          waiverAccepted: true,
          estimatedFinishMinutes: participant.eft ?? null,
          waveLabel: waveOf(participant),
          amountCents: pricing!.priceCents,
          platformFeeCents: pricing!.platformFeeCents,
          feeStructure: event.feeStructure,
          status: "CONFIRMED" as const,
          stripePaymentIntentId: paymentIntent.id,
        };
      }),
    });
    return null;
  });

  if (capacityViolation) {
    console.error("Confirmation refused — over capacity:", paymentIntent.id, capacityViolation);
    await prisma.registration.createMany({
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
    return;
  }

  const participantNames = participants.map((p) => athleteNameFromParticipant(p));
  const notificationBody = participants.length === 1
    ? `${participantNames[0]} registered for ${event.title}`
    : `${participants.length} participants registered for ${event.title}: ${participantNames.join(", ")}`;

  await prisma.notification.create({
    data: {
      organiserId,
      eventId,
      type: "NEW_REGISTRATION",
      title: participants.length === 1 ? "New registration" : "New group registration",
      body: notificationBody,
    },
  }).catch((err: unknown) => console.error("Failed to create notification:", err));

  // When the athlete absorbs the platform fee, the amount charged is
  // price + fee — the email total must reflect that, not just the ticket
  // price. When the organiser absorbs it, the athlete pays the ticket price
  // only and the service fee shown to them is $0.
  const athletePaysFee = event.feeStructure === "athlete";
  for (const participant of participants) {
    if (!participant.em) continue;
    const pricing = priceOf(participant);
    if (!pricing) continue;
    const ticketCents = pricing.priceCents;
    const feeCents = athletePaysFee ? pricing.platformFeeCents : 0;
    sendRegistrationConfirmationEmail(participant.em, {
      eventName:        event.title,
      eventDate:        event.eventDate,
      startTime:        event.startTime,
      category:         waveOf(participant) || meta.category || "General",
      location:         `${event.venue}, ${event.city} ${event.state}`,
      registrationFee:  formatCents(ticketCents),
      serviceFee:       formatCents(feeCents),
      total:            formatCents(ticketCents + feeCents),
      userEmail:        participant.em,
    }).catch((err) => console.error("Failed to send registration confirmation email:", err));
  }
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
