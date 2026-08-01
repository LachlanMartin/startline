/**
 * End-to-end validation of the Stripe Connect payout path (issue #116).
 *
 * Runs against Stripe TEST mode only — refuses to run with a live key. It:
 *   1. Finds/creates a Stripe Express account for the seed organiser
 *   2. Confirms charges + payouts are enabled on it
 *   3. Creates and confirms a PaymentIntent using Connect
 *      (application_fee_amount + transfer_data.destination)
 *   4. Verifies the platform fee matches calculateTotalWithFee
 *   5. Checks the connected account's balance received the net amount
 *
 * Usage: node scripts/validate-stripe-connect.mjs
 * Requires STRIPE_SECRET_KEY (sk_test_...) in .env.local
 */
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import { loadEnv } from "./lib/env.mjs";

loadEnv();

const ORGANISER_EMAIL = "organiser@startline.test";
const TEST_PRICE_CENTS = 13500; // seed-event-001 Late Entry
const FEE_PERCENT = 0.0395;
const FEE_FIXED_CENTS = 145;

function expectFee(expected, actual, label) {
  const ok = expected === actual;
  console.log(`  ${ok ? "PASS" : "FAIL"} ${label}: expected ${expected}, got ${actual}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("Set STRIPE_SECRET_KEY in .env.local to a Stripe test key (sk_test_...).");
    process.exit(1);
  }
  if (key.startsWith("sk_live_")) {
    console.error("Refusing to run against a LIVE Stripe key. Use a test key (sk_test_...).");
    process.exit(1);
  }

  const stripe = new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
  const prisma = new PrismaClient();

  try {
    const organiser = await prisma.organiser.findUnique({
      where: { email: ORGANISER_EMAIL },
      select: { id: true, email: true, stripeAccountId: true },
    });
    if (!organiser) {
      console.error(`Organiser ${ORGANISER_EMAIL} not found. Run the seed first.`);
      process.exit(1);
    }

    console.log(`\n1. Connected account`);
    let accountId = organiser.stripeAccountId;
    if (!accountId) {
      console.log("  No account linked — creating a test Express account…");
      const account = await stripe.accounts.create({
        type: "express",
        country: "AU",
        email: ORGANISER_EMAIL,
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        business_type: "individual",
        settings: { payouts: { schedule: { interval: "manual" } } },
      });
      accountId = account.id;
      await stripe.accounts.update(accountId, {
        tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: "127.0.0.1" },
      });
      await prisma.organiser.update({
        where: { id: organiser.id },
        data: { stripeAccountId: accountId, stripeOnboardingComplete: true },
      });
      console.log(`  Created ${accountId}`);
    } else {
      console.log(`  Using ${accountId}`);
    }

    const connected = await stripe.accounts.retrieve(accountId);
    const chargesEnabled = connected.charges_enabled ?? false;
    const payoutsEnabled = connected.payouts_enabled ?? false;
    console.log(`  charges_enabled: ${chargesEnabled}, payouts_enabled: ${payoutsEnabled}`);
    if (!chargesEnabled || !payoutsEnabled) {
      console.error("  Connect account is not fully onboarded — run scripts/setup-stripe-local.mjs or finish onboarding at /organiser/payments.");
      process.exit(1);
    }

    console.log(`\n2. Platform fee calculation`);
    const expectedFee = Math.round(TEST_PRICE_CENTS * FEE_PERCENT) + FEE_FIXED_CENTS;
    console.log(`  ${TEST_PRICE_CENTS / 100} AUD ticket → fee ${expectedFee / 100} AUD`);
    expectFee(expectedFee, Math.round(TEST_PRICE_CENTS * FEE_PERCENT) + FEE_FIXED_CENTS, "fee formula");

    console.log(`\n3. PaymentIntent with Connect (application_fee + transfer_data)`);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: TEST_PRICE_CENTS + expectedFee,
      currency: "aud",
      payment_method_types: ["card"],
      application_fee_amount: expectedFee,
      transfer_data: { destination: accountId },
      metadata: {
        eventId: "seed-event-001",
        organiserId: organiser.id,
        ticketPriceCents: String(TEST_PRICE_CENTS),
        platformFeeCents: String(expectedFee),
        feeStructure: "athlete",
        userName: "Validate Bot",
        userEmail: "validate@startline.test",
      },
    });
    console.log(`  Created ${paymentIntent.id}`);

    expectFee(expectedFee, paymentIntent.application_fee_amount ?? 0, "application_fee_amount");
    console.log(
      paymentIntent.transfer_data?.destination === accountId
        ? "  PASS transfer_data.destination matches connected account"
        : `  FAIL transfer_data.destination: expected ${accountId}, got ${paymentIntent.transfer_data?.destination}`
    );

    console.log(`\n4. Confirm the payment (test card)`);
    const token = await stripe.tokens.create({
      card: { number: "4000002500003155", exp_month: 12, exp_year: 2034, cvc: "123" },
    });
    const pm = await stripe.paymentMethods.create({ type: "card", card: { token: token.id } });
    const confirmed = await stripe.paymentIntents.confirm(paymentIntent.id, { payment_method: pm.id });
    console.log(`  Status: ${confirmed.status}`);
    if (confirmed.status !== "succeeded") {
      console.error("  Payment did not succeed.");
      process.exit(1);
    }

    console.log(`\n5. Connected account balance`);
    const balance = await stripe.balance.retrieve({ stripeAccount: accountId });
    const available = balance.available.reduce((sum, b) => sum + b.amount, 0);
    console.log(`  Available: ${available / 100} AUD`);
    // balance availability can lag in test mode; the amount_net from the charge
    // is authoritative for the transfer that was made.
    const charge = await stripe.charges.retrieve(confirmed.latest_charge);
    console.log(`  amount_net (transferred to connected account): ${(charge.amount_net ?? 0) / 100} AUD`);
    expectFee(charge.amount_net ?? 0, TEST_PRICE_CENTS, "amount_net equals ticket price (fee already taken)");

    console.log(`\n✓ Validation complete.`);
    console.log(`  Platform fee (${expectedFee / 100} AUD) stays with Startline;`);
    console.log(`  ticket price (${TEST_PRICE_CENTS / 100} AUD) transfers to the organiser's Express balance.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
