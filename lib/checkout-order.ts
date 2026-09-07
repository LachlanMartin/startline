import { z } from "zod";
import prisma from "@/lib/prisma";
import { calculateTotalWithFee } from "@/lib/platform-fee";
import { getUserSession } from "@/lib/amplify-server";
import {
  validateParticipants,
  athleteNameFromParticipant,
  applySharedEmergencyContact,
  getEmailsRequiringVerification,
  type RegistrationFormData,
  type EmergencyContact,
} from "@/lib/registration-form";
import { assertGuestEmailsVerifiedForCheckout } from "@/lib/guest-email-verification";
import { getCapacityError, hasCappedWave } from "@/lib/registration-capacity";
import { todayIso } from "@/lib/event-types";

export type CheckoutParticipant = RegistrationFormData & { waveLabel?: string };

export type CheckoutWave = {
  label: string;
  price: string;
  qty?: number;
  closes?: string;
  date?: string;
};

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

export const checkoutSchema = z.object({
  eventId: z.string().max(255).optional(),
  waveLabel: z.string().max(255).optional(),
  groupRegistration: z.boolean().optional(),
  emergencyContact: z.object({ name: z.string(), phone: z.string() }).optional(),
  turnstileToken: z.string().max(4000).optional(),
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

export type CheckoutBody = z.infer<typeof checkoutSchema>;

export interface OrderEvent {
  id: string;
  title: string;
  status: string;
  feeStructure: string;
  registrationType: string;
  waves: unknown;
  cap: number | null;
  eventDate: string;
  startTime: string;
  venue: string;
  city: string;
  state: string;
  organiser: {
    id: string;
    stripeAccountId: string | null;
    stripeOnboardingComplete: boolean;
  };
}

/** A validated, priced order: everything both the paid and the free path need. */
export interface ResolvedOrder {
  event: OrderEvent;
  waves: CheckoutWave[];
  /** Participants with the shared emergency contact already applied. */
  participants: CheckoutParticipant[];
  /** Ticket tier per participant, aligned by index. */
  waveLabels: string[];
  /** Per-tier price (p) and platform fee (f), both in cents. */
  wavePricing: Record<string, { p: number; f: number }>;
  /** What the athlete pays for the whole order, in cents. Zero means free. */
  totalCents: number;
  /** Startline's cut of the whole order, in cents. */
  platformFeeCents: number;
  groupRegistration: boolean;
  userSession: { sub: string; email: string } | null;
  athleteName: string;
  athleteEmail: string;
}

export type OrderFailure = { error: string; status: number };

export function isOrderFailure(result: ResolvedOrder | OrderFailure): result is OrderFailure {
  return "error" in result;
}

function normalizeParticipants(body: CheckoutBody): CheckoutParticipant[] {
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

function normalizeSharedEmergencyContact(body: CheckoutBody): EmergencyContact | undefined {
  const raw = body.emergencyContact;
  if (raw && typeof raw === "object") {
    return { name: String(raw.name ?? ""), phone: String(raw.phone ?? "") };
  }

  if (body.emergencyContactName || body.emergencyContactPhone) {
    return {
      name: String(body.emergencyContactName ?? ""),
      phone: String(body.emergencyContactPhone ?? ""),
    };
  }

  return undefined;
}

/**
 * Validate and price a registration order.
 *
 * Shared by the paid checkout (which turns this into a Stripe PaymentIntent)
 * and the free path (which writes the registrations straight out), so a free
 * entry passes exactly the same tier, capacity, email-verification and guest
 * checks a paid one does. Whether an order is free is read off the resolved
 * totalCents, never off the request.
 */
export async function resolveCheckoutOrder(
  body: CheckoutBody,
): Promise<ResolvedOrder | OrderFailure> {
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
    // review step (which precedes the actual charge), so the order is priced
    // without requiring it here.
    includeWaiver: false,
  });
  if (firstMessage) return { error: firstMessage, status: 400 };

  // Every ticket resolves to a tier: its own waveLabel (mixed-tier orders) or
  // the order-level waveLabel (legacy single-tier payloads).
  const waveLabels = participants.map((p) => p.waveLabel || waveLabel || "");
  if (!eventId || waveLabels.some((label) => !label)) {
    return { error: "Missing required fields.", status: 400 };
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true, title: true, status: true, feeStructure: true, registrationType: true,
      waves: true, cap: true, eventDate: true, startTime: true, venue: true, city: true, state: true,
      organiser: { select: { id: true, stripeAccountId: true, stripeOnboardingComplete: true } },
    },
  });

  if (!event) return { error: "Event not found.", status: 404 };
  if (event.status !== "APPROVED") {
    return { error: "This event is not currently accepting registrations.", status: 409 };
  }
  if (event.registrationType !== "startline") {
    return { error: "This event uses external registration.", status: 400 };
  }

  const waves = event.waves as CheckoutWave[] | null;
  if (!Array.isArray(waves)) return { error: "No ticket tiers configured.", status: 400 };

  // Validate and price each tier used by the order.
  const usedLabels = [...new Set(waveLabels)];
  const wavePricing: Record<string, { p: number; f: number }> = {};
  for (const label of usedLabels) {
    const wave = waves.find((w) => w.label === label);
    if (!wave) return { error: "Selected ticket tier not found.", status: 400 };

    // Reject tiers whose sales window has closed (legacy waves store the close
    // date in `date`). Guards against a stale client or a hand-crafted request.
    const waveCloses = wave.closes || wave.date;
    if (waveCloses && waveCloses < todayIso()) {
      return { error: `Ticket tier "${label}" has closed.`, status: 409 };
    }

    // A free tier prices at zero and carries no platform fee. Only a negative
    // or unparseable price is invalid.
    const priceCents = Math.round(parseFloat(wave.price || "0") * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      return { error: "Invalid ticket price.", status: 400 };
    }

    const pricing = calculateTotalWithFee(priceCents, event.feeStructure);
    wavePricing[label] = { p: priceCents, f: pricing.platformFeeCents };
  }

  let totalCents = 0;
  let platformFeeCents = 0;
  for (const label of waveLabels) {
    const { p, f } = wavePricing[label];
    totalCents += event.feeStructure === "athlete" ? p + f : p;
    platformFeeCents += f;
  }

  // Only an order that actually charges needs somewhere to send the money. A
  // free event is registerable whether or not its organiser has connected
  // Stripe, so this gate sits after pricing rather than before it.
  const isDirectCharge = process.env.STRIPE_DEV_DIRECT_CHARGE === "true";
  if (totalCents > 0 && !isDirectCharge) {
    if (!event.organiser.stripeOnboardingComplete || !event.organiser.stripeAccountId) {
      return { error: "This event is not ready to accept payments.", status: 409 };
    }
  }

  // Capacity guard — never sell past the event cap or a tier's quantity. The
  // authoritative check runs again, atomically, when the registrations are
  // written; this one just fails fast with a useful message.
  const requestedByWave = waveLabels.reduce<Record<string, number>>((acc, label) => {
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
    if (capacityError) return { error: capacityError, status: 409 };
  }

  const userSession = await getUserSession();
  const emailsToVerify = getEmailsRequiringVerification(
    participants.map((participant) => participant.email),
    userSession?.email,
  );
  const verificationError = await assertGuestEmailsVerifiedForCheckout(emailsToVerify, eventId);
  if (verificationError) return { error: verificationError, status: 400 };

  const resolvedParticipants =
    groupRegistration && sharedEmergencyContact
      ? applySharedEmergencyContact(participants, sharedEmergencyContact)
      : participants;

  const primary = resolvedParticipants[0];

  return {
    event,
    waves,
    participants: resolvedParticipants,
    waveLabels,
    wavePricing,
    totalCents,
    platformFeeCents,
    groupRegistration,
    userSession: userSession ? { sub: userSession.sub, email: userSession.email } : null,
    athleteName: athleteNameFromParticipant(primary),
    athleteEmail: primary.email.trim().toLowerCase(),
  };
}
