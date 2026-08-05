import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { sendRegistrationConfirmationEmail } from "@/lib/email";
import { parseParticipantsFromMetadata, parseWavePricing } from "@/lib/stripe-webhook";
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

  if (participants.length === 0) {
    console.error("No participant data on PaymentIntent:", paymentIntent.id);
    await prisma.registration.create({
      data: {
        eventId,
        organiserId,
        athleteName: meta.userName ?? "Unknown",
        athleteEmail: meta.userEmail ?? "",
        amountCents: parseInt(meta.ticketPriceCents ?? "0", 10),
        platformFeeCents: parseInt(meta.platformFeeCents ?? "0", 10),
        feeStructure: meta.feeStructure ?? "athlete",
        status: "CANCELLED",
        stripePaymentIntentId: paymentIntent.id,
      },
    });
    return;
  }

  const ticketPriceCents = parseInt(meta.ticketPriceCents ?? "0", 10);
  const platformFeePerTicket = parseInt(
    meta.platformFeeCentsPerTicket ?? meta.platformFeeCents ?? "0",
    10
  );

  // Mixed-tier orders: each participant carries its own wave label, priced via
  // the wavePricing map. Legacy intents fall back to the order-level fields.
  const wavePricing = parseWavePricing(meta);
  const waveOf = (participant: CompactParticipant) => participant.wav || meta.waveLabel || null;
  const priceOf = (participant: CompactParticipant) => {
    const wav = waveOf(participant);
    return (wav && wavePricing[wav]?.p) || ticketPriceCents;
  };
  const feeOf = (participant: CompactParticipant) => {
    const wav = waveOf(participant);
    return (wav && wavePricing[wav]?.f) || platformFeePerTicket;
  };

  // For guest participants (no userId in metadata), create Cognito accounts + Prisma Users
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

  await prisma.registration.createMany({
    data: participants.map((participant) => {
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
        amountCents: priceOf(participant),
        platformFeeCents: feeOf(participant),
        feeStructure: meta.feeStructure ?? "athlete",
        status: "CONFIRMED" as const,
        stripePaymentIntentId: paymentIntent.id,
      };
    }),
  });

  const dbEvent = await prisma.event.findUnique({
    where: { id: eventId },
    select: { title: true, eventDate: true, startTime: true, venue: true, city: true, state: true },
  });

  const participantNames = participants.map((p) => athleteNameFromParticipant(p));
  const notificationBody = participants.length === 1
    ? `${participantNames[0]} registered for ${dbEvent?.title ?? "your event"}`
    : `${participants.length} participants registered for ${dbEvent?.title ?? "your event"}: ${participantNames.join(", ")}`;

  await prisma.notification.create({
    data: {
      organiserId,
      eventId,
      type: "NEW_REGISTRATION",
      title: participants.length === 1 ? "New registration" : "New group registration",
      body: notificationBody,
    },
  }).catch((err: unknown) => console.error("Failed to create notification:", err));

  if (dbEvent) {
    // When the athlete absorbs the platform fee, the amount charged is
    // price + fee — the email total must reflect that, not just the ticket
    // price. When the organiser absorbs it, the athlete pays the ticket price
    // only and the service fee shown to them is $0.
    const athletePaysFee = (meta.feeStructure ?? "athlete") === "athlete";
    for (const participant of participants) {
      if (!participant.em) continue;
      const ticketCents = priceOf(participant);
      const feeCents = athletePaysFee ? feeOf(participant) : 0;
      sendRegistrationConfirmationEmail(participant.em, {
        eventName:        dbEvent.title,
        eventDate:        dbEvent.eventDate,
        startTime:        dbEvent.startTime,
        category:         waveOf(participant) || meta.category || "General",
        location:         `${dbEvent.venue}, ${dbEvent.city} ${dbEvent.state}`,
        registrationFee:  formatCents(ticketCents),
        serviceFee:       formatCents(feeCents),
        total:            formatCents(ticketCents + feeCents),
        userEmail:        participant.em,
      }).catch((err) => console.error("Failed to send registration confirmation email:", err));
    }
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
