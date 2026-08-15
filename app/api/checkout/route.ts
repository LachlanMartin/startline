import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { calculateTotalWithFee } from "@/lib/platform-fee";
import { getUserSession } from "@/lib/amplify-server";
import {
  validateParticipants,
  compactParticipant,
  athleteNameFromParticipant,
  applySharedEmergencyContact,
  type RegistrationFormData,
  type EmergencyContact,
} from "@/lib/registration-form";
import {
  getEmailsRequiringVerification,
} from "@/lib/registration-form";
import {
  assertGuestEmailsVerifiedForCheckout,
} from "@/lib/guest-email-verification";
import { getCapacityError, hasCappedWave } from "@/lib/registration-capacity";
import { z } from "zod";

type CheckoutParticipant = RegistrationFormData & { waveLabel?: string };

const participantSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  dateOfBirth: z.string(),
  gender: z.string(),
  email: z.string(),
  mobile: z.string(),
  emergencyContactName: z.string(),
  emergencyContactPhone: z.string(),
  medicalNotes: z.string(),
  estimatedFinish: z.string(),
  waiverAccepted: z.boolean(),
  waveLabel: z.string().max(255).optional(),
});

const checkoutSchema = z.object({
  eventId: z.string().max(255).optional(),
  waveLabel: z.string().max(255).optional(),
  groupRegistration: z.boolean().optional(),
  emergencyContact: z.object({ name: z.string(), phone: z.string() }).optional(),
  participants: z.array(participantSchema).optional(),
  // Legacy single-participant payload fields (pre multi-ticket).
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  email: z.string().optional(),
  mobile: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  medicalNotes: z.string().optional(),
  estimatedFinish: z.string().optional(),
  waiverAccepted: z.boolean().optional(),
});

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function normalizeParticipants(body: Record<string, unknown>): CheckoutParticipant[] {
  if (Array.isArray(body.participants) && body.participants.length > 0) {
    return body.participants as CheckoutParticipant[];
  }

  return [{
    firstName: String(body.firstName ?? ""),
    lastName: String(body.lastName ?? ""),
    dateOfBirth: String(body.dateOfBirth ?? ""),
    gender: String(body.gender ?? ""),
    email: String(body.email ?? ""),
    mobile: String(body.mobile ?? ""),
    emergencyContactName: String(body.emergencyContactName ?? ""),
    emergencyContactPhone: String(body.emergencyContactPhone ?? ""),
    medicalNotes: String(body.medicalNotes ?? ""),
    estimatedFinish: String(body.estimatedFinish ?? ""),
    waiverAccepted: body.waiverAccepted === true,
  }];
}

function normalizeSharedEmergencyContact(body: Record<string, unknown>): EmergencyContact | undefined {
  const raw = body.emergencyContact;
  if (raw && typeof raw === "object") {
    const contact = raw as Record<string, unknown>;
    return {
      name: String(contact.name ?? ""),
      phone: String(contact.phone ?? ""),
    };
  }

  if (body.emergencyContactName || body.emergencyContactPhone) {
    return {
      name: String(body.emergencyContactName ?? ""),
      phone: String(body.emergencyContactPhone ?? ""),
    };
  }

  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const parsedBody = checkoutSchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }
    const body = parsedBody.data;
    const { eventId, waveLabel } = body;
    const participants = normalizeParticipants(body);
    const groupRegistration = body.groupRegistration === true;
    const sharedEmergencyContact = groupRegistration
      ? normalizeSharedEmergencyContact(body)
      : undefined;

    const { firstMessage } = validateParticipants(participants, {
      groupRegistration,
      sharedEmergencyContact,
      // Waiver/terms acceptance is gated client-side by the terms checkbox on the
      // review step (which precedes the actual charge), so the PaymentIntent is
      // created without requiring it here.
      includeWaiver: false,
    });
    if (firstMessage) {
      return NextResponse.json({ error: firstMessage }, { status: 400 });
    }

    // Every ticket resolves to a tier: its own waveLabel (mixed-tier orders) or
    // the order-level waveLabel (legacy single-tier payloads).
    const resolvedWaveLabels = participants.map((p) => p.waveLabel || waveLabel || "");
    if (!eventId || resolvedWaveLabels.some((label) => !label)) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true, title: true, status: true, feeStructure: true, registrationType: true,
        waves: true, cap: true,
        organiser: { select: { id: true, stripeAccountId: true, stripeOnboardingComplete: true } },
      },
    });

    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    if (event.status !== "APPROVED") return NextResponse.json({ error: "This event is not currently accepting registrations." }, { status: 409 });
    if (event.registrationType !== "startline") return NextResponse.json({ error: "This event uses external registration." }, { status: 400 });
    const isDirectCharge = process.env.STRIPE_DEV_DIRECT_CHARGE === "true";
    if (!event.organiser.stripeOnboardingComplete || !event.organiser.stripeAccountId) {
      if (!isDirectCharge) {
        return NextResponse.json({ error: "This event is not ready to accept payments." }, { status: 409 });
      }
    }

    const waves = event.waves as { label: string; price: string; qty?: number; closes?: string; date?: string }[] | null;
    if (!Array.isArray(waves)) return NextResponse.json({ error: "No ticket tiers configured." }, { status: 400 });

    // Validate and price each tier used by the order.
    const usedLabels = [...new Set(resolvedWaveLabels)];
    const wavePricing: Record<string, { p: number; f: number }> = {};
    for (const label of usedLabels) {
      const wave = waves.find((w) => w.label === label);
      if (!wave) return NextResponse.json({ error: "Selected ticket tier not found." }, { status: 400 });

      // Reject tiers whose sales window has closed (legacy waves store the close
      // date in `date`). Guards against a stale client or a hand-crafted request.
      const waveCloses = wave.closes || wave.date;
      if (waveCloses && waveCloses < todayIso()) {
        return NextResponse.json({ error: `Ticket tier "${label}" has closed.` }, { status: 409 });
      }

      const priceCents = Math.round(parseFloat(wave.price || "0") * 100);
      if (priceCents <= 0) return NextResponse.json({ error: "Invalid ticket price." }, { status: 400 });

      const pricing = calculateTotalWithFee(priceCents, event.feeStructure);
      wavePricing[label] = { p: priceCents, f: pricing.platformFeeCents };
    }

    // Capacity guard — never sell past the event cap or a tier's quantity.
    const requestedByWave = resolvedWaveLabels.reduce<Record<string, number>>((acc, label) => {
      acc[label] = (acc[label] ?? 0) + 1;
      return acc;
    }, {});
    const needsCapCheck = event.cap != null;
    const needsWaveCheck = hasCappedWave(waves, usedLabels);
    if (needsCapCheck || needsWaveCheck) {
      const confirmedWhere = { eventId, status: "CONFIRMED" as const };
      const confirmedTotal = needsCapCheck
        ? await prisma.registration.count({ where: confirmedWhere })
        : 0;
      const confirmedByWave: Record<string, number> = {};
      if (needsWaveCheck) {
        const grouped = await prisma.registration.groupBy({
          by: ["waveLabel"],
          where: confirmedWhere,
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
      if (capacityError) {
        return NextResponse.json({ error: capacityError }, { status: 409 });
      }
    }

    const userSession = await getUserSession();
    const emailsToVerify = getEmailsRequiringVerification(
      participants.map((participant) => participant.email),
      userSession?.email
    );
    const verificationError = await assertGuestEmailsVerifiedForCheckout(emailsToVerify, eventId);
    if (verificationError) {
      return NextResponse.json({ error: verificationError }, { status: 400 });
    }

    const participantCount = participants.length;
    let totalCents = 0;
    let platformFeeCents = 0;
    for (const label of resolvedWaveLabels) {
      const { p, f } = wavePricing[label];
      totalCents += event.feeStructure === "athlete" ? p + f : p;
      platformFeeCents += f;
    }

    const participantsForPayment =
      groupRegistration && sharedEmergencyContact
        ? applySharedEmergencyContact(participants, sharedEmergencyContact)
        : participants;

    const primary = participantsForPayment[0];
    const athleteName = athleteNameFromParticipant(primary);
    const athleteEmail = primary.email.trim().toLowerCase();

    const stripe = getStripe();

    const participantMetadata: Record<string, string> = {
      participantCount: String(participantCount),
    };
    participantsForPayment.forEach((participant, index) => {
      participantMetadata[`participant${index}`] = JSON.stringify({
        ...compactParticipant(participant),
        wav: resolvedWaveLabels[index],
      });
    });

    const primaryWave = wavePricing[resolvedWaveLabels[0]];

    // Stripe only permits application_fee_amount alongside a connected account
    // (transfer_data.destination). In dev direct-charge mode there is no
    // connected account, so the charge lands on the platform account with no
    // application fee.
    const useConnect = Boolean(event.organiser.stripeAccountId) && !isDirectCharge;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "aud",
      // Card-only checkout to match the registration payment design (plain
      // card number / expiry / CVC, no multi-method accordion).
      payment_method_types: ["card"],
      ...(useConnect
        ? {
            application_fee_amount: platformFeeCents,
            transfer_data: { destination: event.organiser.stripeAccountId as string },
          }
        : {}),
      metadata: {
        eventId,
        // Legacy single-tier fields (first ticket's tier); per-ticket truth
        // lives in participantN.wav + wavePricing.
        waveLabel: resolvedWaveLabels[0],
        wavePricing: JSON.stringify(wavePricing),
        userName: athleteName,
        userEmail: athleteEmail,
        organiserId: event.organiser.id,
        userId: userSession?.sub ?? "",
        ticketPriceCents: String(primaryWave.p),
        platformFeeCents: String(platformFeeCents),
        platformFeeCentsPerTicket: String(primaryWave.f),
        feeStructure: event.feeStructure,
        groupRegistration: groupRegistration ? "true" : "false",
        ...participantMetadata,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: totalCents / 100,
      platformFee: platformFeeCents / 100,
      participantCount,
    });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Failed to create payment." }, { status: 503 });
  }
}
