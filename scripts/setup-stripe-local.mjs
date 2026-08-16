/**
 * Local Stripe Connect setup for registration testing.
 * Requires STRIPE_SECRET_KEY in .env / .env.local (loaded via dotenv from .env).
 *
 * Usage: node scripts/setup-stripe-local.mjs
 */
import { loadStripeEnv, assertTestKey, getStripe, getPrisma } from "./lib/stripe-test.mjs";

loadStripeEnv();

const ORGANISER_EMAIL = "organiser@startline.test";

async function main() {
  assertTestKey();
  const stripe = getStripe();
  const prisma = getPrisma();

  try {
    const organiser = await prisma.organiser.findUnique({
      where: { email: ORGANISER_EMAIL },
      select: { id: true, stripeAccountId: true, stripeOnboardingComplete: true },
    });

    if (!organiser) {
      console.error(`Organiser ${ORGANISER_EMAIL} not found. Run scripts/local-seed-minimal.sql first.`);
      process.exit(1);
    }

    let accountId = organiser.stripeAccountId;

    if (!accountId) {
      console.log("Creating Stripe Express Connect account (test mode)…");
      const account = await stripe.accounts.create({
        type: "express",
        country: "AU",
        email: ORGANISER_EMAIL,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
      });
      accountId = account.id;
      console.log(`  Created ${accountId}`);
    } else {
      console.log(`Using existing Connect account ${accountId}`);
    }

    // Test-mode helper: accept TOS so charges can be enabled
    await stripe.accounts.update(accountId, {
      tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: "127.0.0.1" },
    });

    const account = await stripe.accounts.retrieve(accountId);
    const chargesEnabled = account.charges_enabled ?? false;
    const payoutsEnabled = account.payouts_enabled ?? false;

    if (!chargesEnabled) {
      console.warn("  charges_enabled is still false — complete Express onboarding in test mode if checkout fails.");
    }

    await prisma.organiser.update({
      where: { id: organiser.id },
      data: {
        stripeAccountId: accountId,
        stripeOnboardingComplete: chargesEnabled && payoutsEnabled,
      },
    });

    console.log("\nOrganiser updated:");
    console.log(`  stripeAccountId:          ${accountId}`);
    console.log(`  stripeOnboardingComplete:   ${chargesEnabled && payoutsEnabled}`);
    console.log(`  charges_enabled:          ${chargesEnabled}`);
    console.log(`  payouts_enabled:          ${payoutsEnabled}`);

    if (!chargesEnabled || !payoutsEnabled) {
      console.log("\nIf checkout still fails, sign in as organiser@startline.test and finish Stripe Connect at /organiser/payments");
    } else {
      console.log("\nReady for checkout testing at /events/seed-event-001/register");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
