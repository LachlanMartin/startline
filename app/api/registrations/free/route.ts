import { NextRequest, NextResponse } from "next/server";
import { compactParticipant } from "@/lib/registration-form";
import { assertTurnstile } from "@/lib/turnstile";
import { rateLimit } from "@/lib/rate-limit";
import {
  checkoutSchema,
  isOrderFailure,
  resolveCheckoutOrder,
} from "@/lib/checkout-order";
import {
  announceRegistrations,
  ensureParticipantUsers,
  insertConfirmedRegistrations,
  type PricedEntry,
} from "@/lib/registration-confirm";

/**
 * POST — register for an event that costs nothing.
 *
 * The paid flow only ever creates registrations from the Stripe webhook, which
 * never fires when there is no payment, so a free order is written here
 * instead. Everything else is identical: the order goes through the same
 * validation, pricing, capacity, email-verification and guest-account work as a
 * paid one, and whether it is free is decided by pricing the tiers from the
 * database, never by the request.
 *
 * Unlike checkout, this endpoint commits: it is called when the athlete accepts
 * the terms and confirms, not when the review step opens.
 */
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

    const botBlocked = await assertTurnstile(req, body, "free-registration");
    if (botBlocked) return botBlocked;

    // No card stands between a bot and a seat on a free event, so the rate limit
    // is the barrier instead.
    const blocked = await rateLimit(req, {
      prefix: "free-registration",
      limit: 10,
      windowSeconds: 600,
    });
    if (blocked) return blocked;

    const order = await resolveCheckoutOrder(body);
    if (isOrderFailure(order)) {
      return NextResponse.json({ error: order.error }, { status: order.status });
    }

    if (order.totalCents > 0) {
      return NextResponse.json(
        { error: "This registration is not free, so it has to be paid for." },
        { status: 400 },
      );
    }

    const { event, participants, waveLabels, wavePricing } = order;

    const entries: PricedEntry[] = participants.map((participant, index) => {
      const label = waveLabels[index];
      return {
        participant: { ...compactParticipant(participant), wav: label },
        waveLabel: label,
        priceCents: wavePricing[label].p,
        platformFeeCents: wavePricing[label].f,
      };
    });

    const buyerUserId = order.userSession?.sub ?? "";
    const userIdByEmail = buyerUserId ? {} : await ensureParticipantUsers(entries);

    const outcome = await insertConfirmedRegistrations({
      event,
      organiserId: event.organiser.id,
      entries,
      buyerUserId,
      userIdByEmail,
      stripePaymentIntentId: null,
      rejectExistingEntries: true,
    });

    // Both a full event and an entry that already exists are conflicts with the
    // current state rather than bad requests.
    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error }, { status: 409 });
    }

    await announceRegistrations(event, event.organiser.id, entries);

    return NextResponse.json({
      registrationIds: outcome.registrationIds,
      participantCount: entries.length,
    });
  } catch (err) {
    console.error("Free registration error:", err);
    return NextResponse.json({ error: "Failed to complete registration." }, { status: 503 });
  }
}
