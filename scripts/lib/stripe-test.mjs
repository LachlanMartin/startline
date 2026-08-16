/**
 * Shared Stripe TEST-mode guards for the validation scripts.
 *
 * Every script that touches Stripe must refuse to run against a live key and
 * fail fast when the key or webhook secret is missing, so nothing ever hits
 * production with test tooling (or vice versa).
 */
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { loadEnv } from "./env.mjs";

export const STRIPE_API_VERSION = "2026-05-27.dahlia";

export function loadStripeEnv() {
  loadEnv();
  assertTestKey();
}

export function assertTestKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.includes("xxxxxxxx")) {
    console.error("Set STRIPE_SECRET_KEY in .env.local to a Stripe TEST key (sk_test_...).");
    process.exit(1);
  }
  if (key.startsWith("sk_live_")) {
    console.error("Refusing to run against a LIVE Stripe key. Use a test key (sk_test_...).");
    process.exit(1);
  }
  return key;
}

export function assertWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error(
      "Set STRIPE_WEBHOOK_SECRET in .env.local (run `pnpm stripe:listen` once and copy the printed whsec_... value)."
    );
    process.exit(1);
  }
  return secret;
}

export function getStripe() {
  return new Stripe(assertTestKey(), { apiVersion: STRIPE_API_VERSION });
}

export function getPrisma() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
}
