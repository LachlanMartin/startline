import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { sendRegistrationConfirmationEmail } from "@/lib/email";
import { getCapacityError, hasCappedWave } from "@/lib/registration-capacity";
import {
  expandCompactParticipant,
  athleteNameFromParticipant,
  type CompactParticipant,
} from "@/lib/registration-form";
import { ensureAthleteCognitoUser } from "@/lib/athlete-accounts";

/** One ticket, priced from the database rather than from the client. */
export interface PricedEntry {
  participant: CompactParticipant;
  waveLabel: string | null;
  priceCents: number;
  platformFeeCents: number;
}

/** The event fields needed to write and announce a registration. */
export interface ConfirmEvent {
  id: string;
  title: string;
  feeStructure: string;
  waves: unknown;
  cap: number | null;
  eventDate: string;
  startTime: string;
  venue: string;
  city: string;
  state: string;
}

const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;
const normalizeEmail = (email: string | undefined) => (email ?? "").trim().toLowerCase();

/**
 * Give every guest participant a Cognito account and a User row, so the entry
 * shows up under their account on Activity. Returns email to User id. Failures
 * are logged and skipped: a registration is never lost over account creation.
 */
export async function ensureParticipantUsers(
  entries: PricedEntry[],
): Promise<Record<string, string>> {
  const userIdByEmail: Record<string, string> = {};
  for (const { participant } of entries) {
    const email = normalizeEmail(participant.em);
    if (!email || userIdByEmail[email]) continue;

    let cognitoSub: string | null = null;
    try {
      cognitoSub = await ensureAthleteCognitoUser(email);
    } catch (err) {
      console.error(`Cognito creation failed for ${email}:`, err);
    }
    const name = athleteNameFromParticipant(participant);
    const user = await prisma.user.upsert({
      where: { email },
      update: { ...(cognitoSub && { cognitoSub }), name: name || undefined },
      create: { email, name: name || undefined, ...(cognitoSub ? { cognitoSub } : {}) },
    });
    userIdByEmail[email] = user.id;
  }
  return userIdByEmail;
}

export type ConfirmOutcome =
  | { ok: true; registrationIds: string[] }
  | { ok: false; error: string; reason: "capacity" | "duplicate" };

/**
 * Write the registrations for an order.
 *
 * The capacity check runs inside the same transaction as the insert, so two
 * concurrent orders can never both pass the count and oversell the event.
 */
export async function insertConfirmedRegistrations(opts: {
  event: ConfirmEvent;
  organiserId: string;
  entries: PricedEntry[];
  /** User id of the signed-in buyer, or "" when the order is a guest checkout. */
  buyerUserId: string;
  /** Guest accounts created by ensureParticipantUsers, keyed by email. */
  userIdByEmail: Record<string, string>;
  stripePaymentIntentId: string | null;
  /**
   * Refuse an entry for someone who already holds one for this event. A paid
   * order is protected from double submission by its PaymentIntent, which is
   * created once and checked for on the way in; a free order has no such token,
   * so the guard is the athlete's own identity.
   */
  rejectExistingEntries?: boolean;
}): Promise<ConfirmOutcome> {
  const { event, organiserId, entries, buyerUserId, userIdByEmail, stripePaymentIntentId } = opts;
  const waves = Array.isArray(event.waves) ? (event.waves as { label: string; qty?: number }[]) : [];
  const registrationIds = entries.map(() => randomUUID());

  return prisma.$transaction(async (tx) => {
    if (opts.rejectExistingEntries) {
      const emails = [...new Set(entries.map((e) => normalizeEmail(e.participant.em)).filter(Boolean))];
      const existing = await tx.registration.findMany({
        where: { eventId: event.id, status: { not: "CANCELLED" }, athleteEmail: { in: emails, mode: "insensitive" } },
        select: { athleteEmail: true, firstName: true, lastName: true, dateOfBirth: true },
      });
      // Match on the person, not just the address: one email can legitimately
      // carry several entries (a parent registering their children).
      const identity = (email: string, first: string, last: string, dob: string) =>
        `${normalizeEmail(email)}|${first.trim().toLowerCase()}|${last.trim().toLowerCase()}|${dob}`;
      const taken = new Set(
        existing.map((r) =>
          identity(r.athleteEmail, r.firstName ?? "", r.lastName ?? "", r.dateOfBirth ?? ""),
        ),
      );
      for (const { participant } of entries) {
        const key = identity(participant.em, participant.fn, participant.ln, participant.dob);
        if (taken.has(key)) {
          return {
            ok: false as const,
            reason: "duplicate" as const,
            error: `${athleteNameFromParticipant(participant)} is already registered for this event.`,
          };
        }
        // Catches duplicates inside a single order too.
        taken.add(key);
      }
    }

    const requestedByWave = entries.reduce<Record<string, number>>((acc, { waveLabel }) => {
      if (waveLabel) acc[waveLabel] = (acc[waveLabel] ?? 0) + 1;
      return acc;
    }, {});
    const usedLabels = Object.keys(requestedByWave);
    const needsCapCheck = event.cap != null;
    const needsWaveCheck = hasCappedWave(waves, usedLabels);
    const confirmedTotal = needsCapCheck
      ? await tx.registration.count({ where: { eventId: event.id, status: "CONFIRMED" } })
      : 0;
    const confirmedByWave: Record<string, number> = {};
    if (needsWaveCheck) {
      const grouped = await tx.registration.groupBy({
        by: ["waveLabel"],
        where: { eventId: event.id, status: "CONFIRMED" },
        _count: { _all: true },
      });
      for (const row of grouped) {
        if (row.waveLabel) confirmedByWave[row.waveLabel] = row._count._all;
      }
    }
    const capacityError = getCapacityError({
      cap: event.cap,
      confirmedTotal,
      requestedTotal: entries.length,
      waves,
      usedLabels,
      confirmedByWave,
      requestedByWave,
    });
    if (capacityError) {
      return { ok: false as const, reason: "capacity" as const, error: capacityError };
    }

    await tx.registration.createMany({
      data: entries.map(({ participant, waveLabel, priceCents, platformFeeCents }, index) => {
        const expanded = expandCompactParticipant(participant);
        const email = normalizeEmail(participant.em);
        return {
          id: registrationIds[index],
          eventId: event.id,
          organiserId,
          userId: buyerUserId || userIdByEmail[email] || null,
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
          waveLabel,
          amountCents: priceCents,
          platformFeeCents,
          feeStructure: event.feeStructure,
          status: "CONFIRMED" as const,
          stripePaymentIntentId,
        };
      }),
    });

    return { ok: true as const, registrationIds };
  });
}

/**
 * Tell the organiser and email the athletes. Best-effort throughout: the
 * registrations are already written, so nothing here may throw back at the
 * caller.
 */
export async function announceRegistrations(
  event: ConfirmEvent,
  organiserId: string,
  entries: PricedEntry[],
): Promise<void> {
  const names = entries.map(({ participant }) => athleteNameFromParticipant(participant));
  const notificationBody = entries.length === 1
    ? `${names[0]} registered for ${event.title}`
    : `${entries.length} participants registered for ${event.title}: ${names.join(", ")}`;

  await prisma.notification.create({
    data: {
      organiserId,
      eventId: event.id,
      type: "NEW_REGISTRATION",
      title: entries.length === 1 ? "New registration" : "New group registration",
      body: notificationBody,
    },
  }).catch((err: unknown) => console.error("Failed to create notification:", err));

  // When the athlete absorbs the platform fee, the amount charged is
  // price + fee — the email total must reflect that, not just the ticket
  // price. When the organiser absorbs it, the athlete pays the ticket price
  // only and the service fee shown to them is $0. A free entry is $0 across
  // the board.
  const athletePaysFee = event.feeStructure === "athlete";
  for (const { participant, waveLabel, priceCents, platformFeeCents } of entries) {
    if (!participant.em) continue;
    const feeCents = athletePaysFee ? platformFeeCents : 0;
    sendRegistrationConfirmationEmail(participant.em, {
      eventName:        event.title,
      eventDate:        event.eventDate,
      startTime:        event.startTime,
      category:         waveLabel || "General",
      location:         `${event.venue}, ${event.city} ${event.state}`,
      registrationFee:  formatCents(priceCents),
      serviceFee:       formatCents(feeCents),
      total:            formatCents(priceCents + feeCents),
      userEmail:        participant.em,
    }).catch((err) => console.error("Failed to send registration confirmation email:", err));
  }
}
