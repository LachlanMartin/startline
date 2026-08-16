import { test, expect } from "@playwright/test";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolve } from "path";

// The spec process does not auto-load .env.local (only `pnpm dev` does), so
// pull in STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / DATABASE_URL from it
// unless they're already in the environment (CI exports them).
if (!process.env.STRIPE_SECRET_KEY) {
  try {
    process.loadEnvFile(resolve(process.cwd(), ".env.local"));
  } catch {
    // .env.local missing (CI) — guard below will skip the suite.
  }
}

/**
 * Stripe lifecycle E2E — REAL test-mode Stripe, env-guarded.
 *
 * Covers checkout (via the real /api/checkout route, which the validation
 * script bypasses) → card confirm → signed webhook → CONFIRMED registration →
 * athlete refund-request → admin refund. Skips entirely when STRIPE_SECRET_KEY
 * or STRIPE_WEBHOOK_SECRET is absent, mirroring the hasCognito guard in
 * auth.spec.ts so CI without Stripe stays green.
 *
 * Prerequisites:
 *   - The dev server must be running with STRIPE_SECRET_KEY and
 *     STRIPE_WEBHOOK_SECRET in .env.local (pnpm dev loads it).
 *   - The seed organiser sarah.mitchell@startline.test must be Stripe-onboarded
 *     (run `pnpm stripe:setup` or scripts/setup-stripe-local.mjs first).
 *   - Turnstile must be unconfigured (fails open) or the checkout route rejects.
 *
 * This spec creates its own fixture event, so it does not depend on the
 * validation script having run.
 */
const hasStripe = !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET;

const PRICE_CENTS = 13500;
const FEE_PERCENT = 0.0395;
const FEE_FIXED_CENTS = 145;
const platformFee = (p: number) => Math.round(p * FEE_PERCENT) + FEE_FIXED_CENTS;

const FIXTURE_EVENT_ID = "test-stripe-e2e-athlete";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_unset", {
  apiVersion: "2026-05-27.dahlia",
});

async function ensureFixture(organiserId: string) {
  const data = {
    status: "APPROVED" as const,
    title: "Stripe E2E Playwright fixture",
    discipline: "crossfit",
    eventDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
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
    waves: [{ label: "General", price: (PRICE_CENTS / 100).toFixed(2) }],
    registrationType: "startline",
    feeStructure: "athlete",
    photos: [],
  };
  const event = await prisma.event.upsert({
    where: { id: FIXTURE_EVENT_ID },
    update: data,
    create: { id: FIXTURE_EVENT_ID, organiserId, ...data },
  });
  await prisma.registration.deleteMany({ where: { eventId: FIXTURE_EVENT_ID } });
  return event;
}

async function getOrganiser() {
  return prisma.organiser.findUnique({
    where: { email: "sarah.mitchell@startline.test" },
    select: { id: true, stripeAccountId: true, stripeOnboardingComplete: true },
  });
}

async function postSignedWebhook(paymentIntent: Stripe.PaymentIntent) {
  const payload = JSON.stringify({
    id: `evt_test_${Date.now()}`,
    object: "event",
    api_version: "2026-05-27.dahlia",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "payment_intent.succeeded",
    data: { object: paymentIntent },
  });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET!,
  });
  const res = await fetch("http://localhost:3000/api/stripe/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": signature },
    body: payload,
  });
  return res;
}

test.describe("stripe lifecycle (real test-mode Stripe)", () => {
  test.skip(!hasStripe, "STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET not set — skipping real Stripe lifecycle");

  test("checkout API → confirm card → webhook → CONFIRMED registration → refund", async ({ request }) => {
    const organiser = await getOrganiser();
    if (!organiser || !organiser.stripeAccountId || !organiser.stripeOnboardingComplete) {
      test.skip(true, "Seed organiser is not Stripe-onboarded — run `pnpm stripe:setup` first");
      return;
    }
    await ensureFixture(organiser.id);

    // 1. Real /api/checkout route (bypass cookie gives jade.nguyen's session,
    //    so the guest email-verify gate is skipped for that email).
    const checkoutRes = await request.post("/api/checkout", {
      headers: { Cookie: "__e2e_bypass=user" },
      data: {
        eventId: FIXTURE_EVENT_ID,
        waveLabel: "General",
        participants: [
          {
            firstName: "Jade",
            lastName: "Nguyen",
            dateOfBirth: "1990-01-01",
            gender: "Female",
            email: "jade.nguyen@startline.test",
            mobile: "0400000000",
            emergencyContactName: "Sam",
            emergencyContactPhone: "0400000001",
            medicalNotes: "",
            estimatedFinish: "",
            waiverAccepted: true,
            waveLabel: "General",
          },
        ],
      },
    });
    if (checkoutRes.status() === 400 && (await checkoutRes.text()).includes("human")) {
      test.skip(true, "Turnstile is configured — checkout requires a real token");
      return;
    }
    expect(checkoutRes.status()).toBe(200);
    const checkout = await checkoutRes.json();
    expect(checkout.paymentIntentId).toBeTruthy();

    // 2. Assert the real PaymentIntent's Connect fields.
    const fee = platformFee(PRICE_CENTS);
    const pi = await stripe.paymentIntents.retrieve(checkout.paymentIntentId);
    expect(pi.amount).toBe(PRICE_CENTS + fee);
    expect(pi.application_fee_amount).toBe(fee);
    expect(pi.transfer_data?.destination).toBe(organiser.stripeAccountId);

    // 3. Confirm with a Stripe test card.
    const confirmed = await stripe.paymentIntents.confirm(pi.id, { payment_method: "pm_card_visa" });
    expect(confirmed.status).toBe("succeeded");

    // 4. Signed webhook → CONFIRMED registration.
    const retrieved = await stripe.paymentIntents.retrieve(pi.id);
    const webhookRes = await postSignedWebhook(retrieved);
    expect(webhookRes.status).toBe(200);

    const registration = await prisma.registration.findFirst({
      where: { stripePaymentIntentId: pi.id },
    });
    expect(registration).toBeTruthy();
    expect(registration!.status).toBe("CONFIRMED");
    expect(registration!.amountCents).toBe(PRICE_CENTS);
    expect(registration!.platformFeeCents).toBe(fee);
    expect(registration!.feeStructure).toBe("athlete");

    // 5. Athlete refund-request (ownership: registration.userId links to the
    //    jade.nguyen bypass session) → admin refund → REFUNDED + Stripe refund.
    const reqRes = await request.post(`/api/user/registrations/${registration!.id}/refund-request`, {
      headers: { Cookie: "__e2e_bypass=user" },
    });
    expect(reqRes.status()).toBe(200);

    const refundRes = await request.post(`/api/admin/registrations/${registration!.id}/refund`, {
      headers: { Cookie: "__e2e_bypass=admin" },
    });
    expect(refundRes.status()).toBe(200);
    const refundBody = await refundRes.json();
    expect(refundBody.refundId).toBeTruthy();

    const refund = await stripe.refunds.retrieve(refundBody.refundId);
    expect(refund.status).toBe("succeeded");

    const after = await prisma.registration.findUnique({ where: { id: registration!.id } });
    expect(after!.status).toBe("REFUNDED");
  });
});
