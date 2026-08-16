/**
 * End-to-end validation of the full Stripe payment lifecycle (issue #253).
 *
 * Runs against Stripe TEST mode only — refuses to run with a live key. For
 * each feeStructure variant ("athlete" and "organiser") it:
 *   1. Creates a PaymentIntent mirroring the checkout route (Connect:
 *      application_fee_amount + transfer_data.destination) and asserts the
 *      amount / fee / destination fields
 *   2. Confirms the payment with a Stripe test card and asserts status
 *      "succeeded"
 *   3. Forges a real signed payment_intent.succeeded webhook payload and POSTs
 *      it to the running /api/stripe/webhook route, then asserts the CONFIRMED
 *      Registration rows carry the correct amountCents / platformFeeCents /
 *      feeStructure
 *   4. Exercises the refund path: athlete refund-request → admin refund →
 *      Stripe refund created + registration REFUNDED
 *   5. Exercises the payout path: admin-triggered payout against the connected
 *      Express account, asserts payoutTriggered / payoutAmountCents /
 *      payoutAt, and asserts a retry returns 409 with no double-pay
 *
 * Prerequisites:
 *   - STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET in .env.local (test mode)
 *   - A running dev server (`pnpm dev`) — the webhook / refund / payout steps
 *     hit real HTTP routes with the __e2e_bypass cookies
 *
 * Usage: node scripts/validate-stripe-lifecycle.mjs
 *
 * Gated assertions (flip on once the fixes land):
 *   - EXPECT_ORGANISER_NET=1 → hard-assert the organiser payout net equals
 *     Σ(amountCents − platformFeeCents) instead of the current over-pay (issue
 *     #251)
 */
import {
  loadStripeEnv,
  assertTestKey,
  assertWebhookSecret,
  getStripe,
  getPrisma,
  STRIPE_API_VERSION,
} from "./lib/stripe-test.mjs";

loadStripeEnv();

const ORGANISER_EMAIL = "sarah.mitchell@startline.test";
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const PRICE_CENTS = 13500; // $135.00 General ticket on the fixture events
const FEE_PERCENT = 0.0395;
const FEE_FIXED_CENTS = 145;

const expectOrganiserNet = process.env.EXPECT_ORGANISER_NET === "1";

const ATHLETE_REFUND_EVENT = "test-stripe-athlete-refund";
const ORGANISER_REFUND_EVENT = "test-stripe-organiser-refund";
const ATHLETE_PAYOUT_EVENT = "test-stripe-athlete-payout";
const ORGANISER_PAYOUT_EVENT = "test-stripe-organiser-payout";

const platformFee = (priceCents) => Math.round(priceCents * FEE_PERCENT) + FEE_FIXED_CENTS;

let failures = 0;
const check = (label, ok, extra = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures += 1;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fixtureEvent(feeStructure, date, payout) {
  const wave = { label: "General", price: (PRICE_CENTS / 100).toFixed(2) };
  return {
    status: "APPROVED",
    title: `Stripe E2E ${feeStructure} ${payout ? "payout" : "refund"} fixture`,
    discipline: "crossfit",
    eventDate: date,
    startTime: "07:30",
    endTime: "17:00",
    venue: "Test Venue",
    city: "Melbourne",
    state: "vic",
    format: "individual",
    level: "open",
    categories: ["Open"],
    cap: null,
    minAge: 16,
    waves: [wave],
    registrationType: "startline",
    feeStructure,
    photos: [],
  };
}

function tomorrow() {
  return new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
}

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

async function ensureFixtureEvents(prisma, organiserId) {
  const upsert = (id, data) =>
    prisma.event.upsert({ where: { id }, update: data, create: { id, organiserId, ...data } });
  const refundAthlete = await upsert(ATHLETE_REFUND_EVENT, fixtureEvent("athlete", tomorrow(), false));
  const refundOrganiser = await upsert(ORGANISER_REFUND_EVENT, fixtureEvent("organiser", tomorrow(), false));
  const payoutAthlete = await upsert(ATHLETE_PAYOUT_EVENT, fixtureEvent("athlete", daysAgo(30), true));
  const payoutOrganiser = await upsert(ORGANISER_PAYOUT_EVENT, fixtureEvent("organiser", daysAgo(30), true));
  return { refundAthlete, refundOrganiser, payoutAthlete, payoutOrganiser };
}

async function resetFixtures(prisma) {
  const ids = [ATHLETE_REFUND_EVENT, ORGANISER_REFUND_EVENT, ATHLETE_PAYOUT_EVENT, ORGANISER_PAYOUT_EVENT];
  await prisma.registration.deleteMany({ where: { eventId: { in: ids } } });
  await prisma.event.updateMany({
    where: { id: { in: [ATHLETE_PAYOUT_EVENT, ORGANISER_PAYOUT_EVENT] } },
    data: { payoutTriggered: false, payoutAmountCents: null, payoutAt: null },
  });
}

async function ensureConnectAccount(stripe, prisma) {
  const organiser = await prisma.organiser.findUnique({
    where: { email: ORGANISER_EMAIL },
    select: { id: true, stripeAccountId: true, stripeOnboardingComplete: true },
  });
  if (!organiser) {
    console.error(`Organiser ${ORGANISER_EMAIL} not found. Run the seed first.`);
    process.exit(1);
  }

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
  }

  const connected = await stripe.accounts.retrieve(accountId);
  const chargesEnabled = connected.charges_enabled ?? false;
  const payoutsEnabled = connected.payouts_enabled ?? false;
  console.log(`  charges_enabled: ${chargesEnabled}, payouts_enabled: ${payoutsEnabled}`);
  if (!chargesEnabled || !payoutsEnabled) {
    console.error("  Connect account is not fully onboarded — run scripts/setup-stripe-local.mjs or finish onboarding.");
    process.exit(1);
  }
  return { accountId, organiserId: organiser.id };
}

function buildPaymentIntentArgs({ feeStructure, accountId, organiserId, eventId, priceCents, athleteEmail, athleteName }) {
  const fee = platformFee(priceCents);
  const amount = feeStructure === "athlete" ? priceCents + fee : priceCents;
  return {
    amount,
    currency: "aud",
    payment_method_types: ["card"],
    application_fee_amount: fee,
    transfer_data: { destination: accountId },
    metadata: {
      eventId,
      waveLabel: "General",
      wavePricing: JSON.stringify({ General: { p: priceCents, f: fee } }),
      userName: athleteName,
      userEmail: athleteEmail,
      organiserId,
      userId: "",
      ticketPriceCents: String(priceCents),
      platformFeeCents: String(fee),
      platformFeeCentsPerTicket: String(fee),
      feeStructure,
      groupRegistration: "false",
      participantCount: "1",
      participant0: JSON.stringify({
        fn: athleteName.split(" ")[0] ?? "Stripe",
        ln: athleteName.split(" ").slice(1).join(" ") || "E2E",
        dob: "1990-01-01",
        gen: "Female",
        em: athleteEmail,
        mob: "0400000000",
        ecn: "Sam",
        ecp: "0400000001",
        wav: "General",
      }),
    },
  };
}

/** POST /api/stripe/webhook with a real signed payload (no Stripe CLI needed). */
async function deliverSignedWebhook(stripe, webhookSecret, paymentIntent) {
  const payload = JSON.stringify({
    id: `evt_test_${Date.now()}`,
    object: "event",
    api_version: STRIPE_API_VERSION,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "payment_intent.succeeded",
    data: { object: paymentIntent },
  });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
  const res = await fetch(`${BASE}/api/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": signature },
    body: payload,
  });
  return res;
}

async function waitForRegistration(prisma, paymentIntentId, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const reg = await prisma.registration.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
    });
    if (reg) return reg;
    await sleep(500);
  }
  return null;
}

async function postWithBypass(path, cookie, body) {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `__e2e_bypass=${cookie}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function waitForConnectedBalance(stripe, accountId, minCents, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const balance = await stripe.balance.retrieve({ stripeAccount: accountId });
    const available = balance.available.reduce((sum, b) => sum + b.amount, 0);
    if (available >= minCents) return available;
    await sleep(2000);
  }
  throw new Error(`Connected account balance never reached ${minCents} cents in ${timeoutMs}ms`);
}

/**
 * Checkout → confirm → webhook → CONFIRMED registration. Returns the
 * registration, paymentIntent, and the expected cents.
 */
async function runChargeFlow({ stripe, prisma, webhookSecret, feeStructure, eventId, accountId, organiserId, athleteEmail, athleteName }) {
  const fee = platformFee(PRICE_CENTS);
  const expectedTotal = feeStructure === "athlete" ? PRICE_CENTS + fee : PRICE_CENTS;

  console.log(`\n  Create PaymentIntent (feeStructure=${feeStructure})`);
  const pi = await stripe.paymentIntents.create(
    buildPaymentIntentArgs({ feeStructure, accountId, organiserId, eventId, priceCents: PRICE_CENTS, athleteEmail, athleteName })
  );
  check(`amount = ${expectedTotal}`, pi.amount === expectedTotal, `got ${pi.amount}`);
  check(`application_fee_amount = ${fee}`, pi.application_fee_amount === fee, `got ${pi.application_fee_amount}`);
  check(
    `transfer_data.destination = connected account`,
    pi.transfer_data?.destination === accountId,
    `got ${pi.transfer_data?.destination}`
  );

  const confirmed = await stripe.paymentIntents.confirm(pi.id, { payment_method: "pm_card_visa" });
  check("card confirmation status = succeeded", confirmed.status === "succeeded", `got ${confirmed.status}`);
  if (confirmed.status !== "succeeded") return null;

  const retrieved = await stripe.paymentIntents.retrieve(pi.id);
  const res = await deliverSignedWebhook(stripe, webhookSecret, retrieved);
  check("webhook POST accepted", res.status === 200, `got ${res.status}`);

  const registration = await waitForRegistration(prisma, pi.id);
  if (!registration) {
    check("registration created via webhook", false, "not found within timeout");
    return null;
  }
  check("registration status = CONFIRMED", registration.status === "CONFIRMED", `got ${registration.status}`);
  check("registration amountCents", registration.amountCents === PRICE_CENTS, `got ${registration.amountCents}`);
  check("registration platformFeeCents", registration.platformFeeCents === fee, `got ${registration.platformFeeCents}`);
  check("registration feeStructure", registration.feeStructure === feeStructure, `got ${registration.feeStructure}`);

  return { registration, paymentIntent: retrieved, expectedTotal };
}

async function runRefundFlow({ stripe, registration }) {
  console.log("\n  Refund (athlete refund-request → admin refund)");
  const reqRes = await postWithBypass(`/api/user/registrations/${registration.id}/refund-request`, "user");
  const reqBody = await reqRes.json().catch(() => ({}));
  check(
    "athlete refund-request accepted",
    reqRes.status === 200 && reqBody.status === "REFUND_REQUESTED",
    `got ${reqRes.status} ${JSON.stringify(reqBody)}`
  );

  const refundRes = await postWithBypass(`/api/admin/registrations/${registration.id}/refund`, "admin");
  const refundBody = await refundRes.json().catch(() => ({}));
  check(
    "admin refund accepted",
    refundRes.status === 200 && refundBody.refundId,
    `got ${refundRes.status} ${JSON.stringify(refundBody)}`
  );
  if (!refundBody.refundId) return;

  const refund = await stripe.refunds.retrieve(refundBody.refundId);
  check("Stripe refund created", Boolean(refund.id), refund.id);
  check("Stripe refund status = succeeded", refund.status === "succeeded", `got ${refund.status}`);

  const after = await prisma.registration.findUnique({ where: { id: registration.id } });
  check("registration status = REFUNDED", after?.status === "REFUNDED", `got ${after?.status}`);
}

async function runPayoutFlow({ stripe, prisma, eventId, feeStructure, accountId, organiserId, webhookSecret, runPayout }) {
  console.log("\n  Payout (admin-triggered, post-event)");

  const flow = await runChargeFlow({
    stripe,
    prisma,
    webhookSecret,
    feeStructure,
    eventId,
    accountId,
    organiserId,
    athleteEmail: "stripe-e2e@startline.test",
    athleteName: "Stripe E2E Athlete",
  });
  if (!flow) return;

  const fee = platformFee(PRICE_CENTS);
  const expectedNet = feeStructure === "athlete" ? PRICE_CENTS : PRICE_CENTS - fee; // #251-correct net

  if (!runPayout) {
    console.log(
      `  WARN #251: skipping the admin payout trigger for feeStructure "organiser" — ` +
        `runPayoutForEvent pays Σ amountCents (${PRICE_CENTS}) but the connected account only holds ` +
        `${expectedNet} after the platform fee, so Stripe rejects the payout. Once #251 lands, set ` +
        `EXPECT_ORGANISER_NET=1 to run it and assert the corrected net.`
    );
    return;
  }

  await waitForConnectedBalance(stripe, accountId, expectedNet);

  const res = await postWithBypass("/api/admin/payouts", "admin", { eventId });
  const body = await res.json().catch(() => ({}));
  check("admin payout triggered", res.status === 200 && body.ok === true, `got ${res.status} ${JSON.stringify(body)}`);

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  check("payoutTriggered = true", event?.payoutTriggered === true, `got ${event?.payoutTriggered}`);
  check("payoutAt set", Boolean(event?.payoutAt));
  check(
    "payoutAmountCents = Σ(amountCents − platformFeeCents)",
    event?.payoutAmountCents === expectedNet,
    `got ${event?.payoutAmountCents}, expected ${expectedNet}`
  );

  // No double-pay: the second POST must be rejected (409) and no new Stripe
  // payout object may appear after the first succeeded.
  const payoutsAfterFirst = await stripe.payouts.list({ limit: 100 }, { stripeAccount: accountId });
  const retry = await postWithBypass("/api/admin/payouts", "admin", { eventId });
  check("retry payout rejected (no double-pay)", retry.status === 409, `got ${retry.status}`);
  const payoutsAfterRetry = await stripe.payouts.list({ limit: 100 }, { stripeAccount: accountId });
  check(
    "no new Stripe payout on retry",
    payoutsAfterRetry.data.length === payoutsAfterFirst.data.length,
    `${payoutsAfterFirst.data.length} → ${payoutsAfterRetry.data.length}`
  );
}

async function main() {
  assertTestKey();
  const webhookSecret = assertWebhookSecret();
  const stripe = getStripe();
  const prisma = getPrisma();

  try {
    console.log("0. Connected Express account");
    const { accountId, organiserId } = await ensureConnectAccount(stripe, prisma);

    console.log("\n1. Fixture events");
    await resetFixtures(prisma);
    const fixtures = await ensureFixtureEvents(prisma, organiserId);
    console.log(
      `  ${fixtures.refundAthlete.id}, ${fixtures.refundOrganiser.id}, ` +
      `${fixtures.payoutAthlete.id}, ${fixtures.payoutOrganiser.id}`
    );

    for (const feeStructure of ["athlete", "organiser"]) {
      console.log(`\n=== feeStructure: "${feeStructure}" ===`);

      console.log("\n-- Refund lifecycle --");
      const refundEventId = feeStructure === "athlete" ? ATHLETE_REFUND_EVENT : ORGANISER_REFUND_EVENT;
      const refundFlow = await runChargeFlow({
        stripe, prisma, webhookSecret, feeStructure,
        eventId: refundEventId, accountId, organiserId,
        athleteEmail: "jade.nguyen@startline.test",
        athleteName: "Jade Nguyen",
      });
      if (refundFlow) {
        await runRefundFlow({ stripe, registration: refundFlow.registration });
        // Reset so the payout loop's charge flow starts clean.
        await resetFixtures(prisma);
      }

      console.log("\n-- Payout lifecycle --");
      const payoutEventId = feeStructure === "athlete" ? ATHLETE_PAYOUT_EVENT : ORGANISER_PAYOUT_EVENT;
      await runPayoutFlow({
        stripe, prisma, webhookSecret, feeStructure,
        eventId: payoutEventId, accountId, organiserId,
        runPayout: feeStructure === "athlete" || expectOrganiserNet,
      });
      await resetFixtures(prisma);
    }

    console.log(failures === 0 ? "\n✓ Stripe lifecycle validation complete." : `\n✗ ${failures} assertion(s) failed.`);
    if (failures > 0) process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
