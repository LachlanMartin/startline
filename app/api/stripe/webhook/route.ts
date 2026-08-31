import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { sendRegistrationConfirmationEmail } from "@/lib/email";
import { parseParticipantsFromMetadata, parseAddOnsFromMetadata } from "@/lib/stripe-webhook";
import {
  priceAddOnSelection,
  selectionFromCodeLines,
  sumAddOnLines,
  type PricedAddOnLine,
} from "@/lib/add-on-pricing";
import { partitionByStock } from "@/lib/add-on-stock";
import {
  catalogueVariantsForEvent,
  heldByVariant,
  stockByVariant,
} from "@/lib/add-on-catalogue";
import { buildRefundParams } from "@/lib/stripe-refunds";
import { addOnSummaryLabel } from "@/lib/add-ons";
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

/**
 * Refund add-on lines that lost the last-unit race, and tell both parties.
 *
 * Called after the confirming transaction has committed, so the entries are
 * already safe. Everything here is best-effort by design: a failed refund or a
 * failed notification must never turn a confirmed entry back into a problem. A
 * failure is logged loudly instead, because it leaves money that needs a human.
 */
async function refundOversoldAddOns(input: {
  paymentIntent: Stripe.PaymentIntent;
  dropped: PricedAddOnLine[];
  eventId: string;
  organiserId: string;
  eventTitle: string;
  buyerUserId: string;
}): Promise<void> {
  const { paymentIntent, dropped, eventId, organiserId, eventTitle, buyerUserId } = input;
  if (dropped.length === 0) return;

  const droppedCents = sumAddOnLines(dropped).chargedCents;
  const droppedLabels = dropped
    .map((line) =>
      addOnSummaryLabel({
        participantIndex: line.participantIndex,
        name: line.name,
        variantLabel: line.variantLabel,
        quantity: line.quantity,
      }),
    )
    .join(", ");

  console.error("Add-on lines oversold, refunding:", paymentIntent.id, {
    droppedCents,
    droppedLabels,
  });

  if (droppedCents > 0) {
    try {
      const chargeId =
        typeof paymentIntent.latest_charge === "string"
          ? paymentIntent.latest_charge
          : paymentIntent.latest_charge?.id;
      if (!chargeId) {
        console.error("No charge to refund oversold add-ons against:", paymentIntent.id);
      } else {
        await getStripe().refunds.create(
          ...buildRefundParams({
            chargeId,
            amountCents: droppedCents,
            // Keyed on the intent so a webhook redelivery cannot refund twice.
            idempotencyKey: `addon-oversold-${paymentIntent.id}`,
          }),
        );
      }
    } catch (err) {
      console.error("Failed to refund oversold add-ons:", paymentIntent.id, err);
    }
  }

  // The organiser needs this so their picking list and their books agree.
  await prisma.notification
    .create({
      data: {
        organiserId,
        eventId,
        type: "NEW_REGISTRATION",
        title: "Add-on sold out during checkout",
        body:
          `${droppedLabels} could not be fulfilled on a paid order because stock ran out. ` +
          `${formatCents(droppedCents)} has been refunded automatically. The entry is confirmed.`,
      },
    })
    .catch((err: unknown) => console.error("Failed to notify organiser of dropped add-ons:", err));

  // The athlete needs it so they are not waiting for a parcel that is not coming.
  if (buyerUserId) {
    await prisma.userNotification
      .create({
        data: {
          userId: buyerUserId,
          type: "REFUND_PROCESSED",
          title: "An extra sold out",
          body:
            `${droppedLabels} sold out while your payment was going through, so we could not ` +
            `include it. ${formatCents(droppedCents)} is on its way back to your card. ` +
            `Your entry to ${eventTitle} is confirmed.`,
          eventId,
        },
      })
      .catch((err: unknown) => console.error("Failed to notify athlete of dropped add-ons:", err));
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
      title: true, status: true, feeStructure: true, registrationType: true,
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

  // Price the add-ons the same way, from the DB, through the same pure module
  // checkout used. The catalogue is fetched UNFILTERED by `active`: a product the
  // organiser retired between the payment and this webhook must still price the
  // purchase in flight, or the total check below cancels an order that was paid
  // for correctly.
  const addOnMetadataLines = parseAddOnsFromMetadata(meta);
  const addOnCatalogue =
    addOnMetadataLines.length > 0 ? await catalogueVariantsForEvent(eventId) : [];
  const addOnPricing = priceAddOnSelection(
    selectionFromCodeLines(addOnMetadataLines, addOnCatalogue),
    addOnCatalogue,
    event.feeStructure,
  );

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
  //
  // This comparison is the most dangerous line in the product: a mismatch writes
  // CANCELLED registrations with amountCents 0 and returns, keeping the athlete's
  // money with no refund. Add-on cents MUST be part of the expected total, and an
  // add-on line that could not be priced MUST fail the check rather than being
  // quietly dropped, because the athlete was charged for it.
  const expectedTicketCents = priced.reduce((sum, { pricing }) => {
    if (!pricing) return sum;
    return sum + (event.feeStructure === "athlete"
      ? pricing.priceCents + pricing.platformFeeCents
      : pricing.priceCents);
  }, 0);
  const expectedTotalCents = expectedTicketCents + sumAddOnLines(addOnPricing.lines).chargedCents;

  // An add-on line pointing at a participant this order does not have is
  // malformed metadata. It is treated as a pricing failure rather than dropped,
  // because there is no registration to hang the purchase on and the athlete may
  // have been charged for it. PaymentIntent metadata is client-influenced, so
  // this has to be checked rather than assumed.
  const addOnsAddressRealParticipants = addOnPricing.lines.every(
    (line) => line.participantIndex < participants.length,
  );

  if (
    paymentIntent.amount_received !== expectedTotalCents ||
    priced.some(({ pricing }) => !pricing) ||
    addOnPricing.unresolved.length > 0 ||
    !addOnsAddressRealParticipants
  ) {
    console.error("PaymentIntent amount does not match DB pricing:", paymentIntent.id, {
      expectedTotalCents,
      expectedTicketCents,
      amountReceived: paymentIntent.amount_received,
      unresolvedAddOns: addOnPricing.unresolved.length,
      addOnsAddressRealParticipants,
    });
    await recordCancelled();
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
  const confirmation = await prisma.$transaction(async (tx) => {
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
    if (capacityError) return { capacityError, droppedAddOns: [] as PricedAddOnLine[] };

    // One create per participant rather than createMany: the add-on rows below
    // need the registration ids, and createMany returns none. N is at most the
    // participants in a single order, so this stays a handful of inserts inside
    // the transaction that was already open.
    const registrationIdByIndex: string[] = [];
    for (const { participant, pricing } of priced) {
      const expanded = expandCompactParticipant(participant);
      const email = participant.em?.toLowerCase().trim() || "";
      const uid = existingUserId || userIdByEmail[email] || "";
      const created = await tx.registration.create({
        data: {
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
          // Add-on money never enters these two columns. That is what keeps
          // "refunding an entry does not refund the merchandise" true without a
          // single edit to the four places that read them.
          amountCents: pricing!.priceCents,
          platformFeeCents: pricing!.platformFeeCents,
          feeStructure: event.feeStructure,
          status: "CONFIRMED" as const,
          stripePaymentIntentId: paymentIntent.id,
        },
        select: { id: true },
      });
      registrationIdByIndex.push(created.id);
    }

    // Authoritative add-on stock check, in the transaction that just inserted the
    // entries. Unlike the ticket capacity check above, losing here NEVER cancels
    // the order: it drops the lines that no longer fit, and they are refunded
    // outside the transaction. Voiding someone's race entry over a t-shirt, with
    // their entry money already captured, is not an acceptable outcome.
    //
    // Like the capacity check, this closes the common case rather than the last
    // microsecond: under READ COMMITTED two simultaneous transactions can both
    // observe the same held count. The blast radius is one unit oversold per
    // variant, which an organiser can absorb, so v1 does not hold stock.
    const droppedAddOns: PricedAddOnLine[] = [];
    if (addOnPricing.lines.length > 0) {
      const [held, stock] = await Promise.all([
        heldByVariant(eventId, tx),
        stockByVariant(eventId, tx),
      ]);
      const available = Object.fromEntries(
        Object.keys(stock).map((variantId) => [
          variantId,
          { stock: stock[variantId] ?? 0, held: held[variantId] ?? 0 },
        ]),
      );
      const { fitting, dropped } = partitionByStock(addOnPricing.lines, available);
      droppedAddOns.push(...dropped);

      if (fitting.length > 0) {
        await tx.registrationAddOn.createMany({
          data: fitting.map((line) => ({
            registrationId: registrationIdByIndex[line.participantIndex],
            eventId,
            addOnId: line.addOnId,
            variantId: line.variantId,
            // Snapshots so a later catalogue edit cannot rewrite a receipt.
            nameSnapshot: line.name,
            optionLabelSnapshot: line.optionLabel,
            variantLabelSnapshot: line.variantLabel,
            imageUrlSnapshot: line.imageUrl,
            unitPriceCents: line.unitPriceCents,
            quantity: line.quantity,
            amountCents: line.amountCents,
            platformFeeCents: line.platformFeeCents,
            feeStructure: event.feeStructure,
            status: "PURCHASED" as const,
          })),
        });
      }
    }

    return { capacityError: null as string | null, droppedAddOns };
  });

  if (confirmation.capacityError) {
    console.error(
      "Confirmation refused — over capacity:",
      paymentIntent.id,
      confirmation.capacityError,
    );
    await recordCancelled();
    return;
  }

  await refundOversoldAddOns({
    paymentIntent,
    dropped: confirmation.droppedAddOns,
    eventId,
    organiserId,
    eventTitle: event.title,
    buyerUserId:
      existingUserId || userIdByEmail[participants[0]?.em?.toLowerCase().trim() ?? ""] || "",
  });

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
  // Only lines that actually made it into the order: anything dropped for stock
  // was refunded above and must not appear on a receipt as though it shipped.
  const droppedKeys = new Set(
    confirmation.droppedAddOns.map((line) => `${line.participantIndex}:${line.variantId}`),
  );
  const confirmedAddOns = addOnPricing.lines.filter(
    (line) => !droppedKeys.has(`${line.participantIndex}:${line.variantId}`),
  );

  priced.forEach(({ participant, pricing }, participantIndex) => {
    if (!participant.em || !pricing) return;
    const ticketCents = pricing.priceCents;
    const feeCents = athletePaysFee ? pricing.platformFeeCents : 0;

    // Each athlete sees the merchandise they chose, not the whole family's.
    const mine = confirmedAddOns.filter((line) => line.participantIndex === participantIndex);
    const addOnCents = mine.reduce((sum, line) => sum + line.chargedCents, 0);

    sendRegistrationConfirmationEmail(participant.em, {
      eventName:        event.title,
      eventDate:        event.eventDate,
      startTime:        event.startTime,
      category:         waveOf(participant) || meta.category || "General",
      location:         `${event.venue}, ${event.city} ${event.state}`,
      registrationFee:  formatCents(ticketCents),
      serviceFee:       formatCents(feeCents),
      total:            formatCents(ticketCents + feeCents + addOnCents),
      userEmail:        participant.em,
      ...(mine.length > 0 && {
        addOns: mine.map((line) => ({
          label: `${line.name}${line.variantLabel ? ` (${line.variantLabel})` : ""} x ${line.quantity}`,
          amount: formatCents(line.chargedCents),
        })),
      }),
    }).catch((err) => console.error("Failed to send registration confirmation email:", err));
  });
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
