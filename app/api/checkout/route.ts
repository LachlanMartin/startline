import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { compactParticipant } from "@/lib/registration-form";
import { assertTurnstile } from "@/lib/turnstile";
import {
  checkoutSchema,
  isOrderFailure,
  resolveCheckoutOrder,
} from "@/lib/checkout-order";

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

    const botBlocked = await assertTurnstile(req, body, "checkout");
    if (botBlocked) return botBlocked;

    const order = await resolveCheckoutOrder(body);
    if (isOrderFailure(order)) {
      return NextResponse.json({ error: order.error }, { status: order.status });
    }

    const {
      event, participants, waveLabels, wavePricing,
      totalCents, platformFeeCents, groupRegistration, userSession,
      athleteName, athleteEmail,
    } = order;

    // Nothing to charge, so there is no PaymentIntent to create. The free path
    // writes the registrations itself once the athlete accepts the terms.
    if (totalCents === 0) {
      return NextResponse.json(
        { error: "This registration is free, so no payment is required.", free: true },
        { status: 400 },
      );
    }

    const stripe = getStripe();

    const participantMetadata: Record<string, string> = {
      participantCount: String(participants.length),
    };
    participants.forEach((participant, index) => {
      participantMetadata[`participant${index}`] = JSON.stringify({
        ...compactParticipant(participant),
        wav: waveLabels[index],
      });
    });

    const primaryWave = wavePricing[waveLabels[0]];

    // Stripe only permits application_fee_amount alongside a connected account
    // (transfer_data.destination). In dev direct-charge mode there is no
    // connected account, so the charge lands on the platform account with no
    // application fee.
    const isDirectCharge = process.env.STRIPE_DEV_DIRECT_CHARGE === "true";
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
        eventId: event.id,
        // Legacy single-tier fields (first ticket's tier); per-ticket truth
        // lives in participantN.wav + wavePricing.
        waveLabel: waveLabels[0],
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
      participantCount: participants.length,
    });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Failed to create payment." }, { status: 503 });
  }
}
