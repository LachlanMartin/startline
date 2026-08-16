---
type: Reference
title: Stripe E2E & Lifecycle Validation
description: How to validate the full Stripe payment lifecycle in test mode — the validate-stripe-lifecycle script and the env-guarded Playwright spec.
tags: [startline, payments, stripe, e2e, playwright, test-mode]
---

# Stripe E2E & Lifecycle Validation

Issue #253 — prove the whole Stripe flow works end-to-end in **test mode**:
checkout → card confirm → webhook → CONFIRMED registration → refund → payout.

Two layers:

1. `scripts/validate-stripe-lifecycle.mjs` — a runnable Node script that drives
   every flow against real test-mode Stripe.
2. `e2e/stripe-lifecycle.spec.ts` — a Playwright spec, env-guarded so CI without
   Stripe keys stays green (mirrors the `hasCognito` guard in `auth.spec.ts`).

## Env guard

Every Stripe entry point refuses to run against a live key or with a missing
key. Shared guards live in `scripts/lib/stripe-test.mjs`:

| Guard | Behaviour |
|---|---|
| `assertTestKey()` | exits on missing / `sk_test_xxxxxxxx` / `sk_live_` key |
| `assertWebhookSecret()` | exits when `STRIPE_WEBHOOK_SECRET` is absent |
| `getStripe()` | `Stripe` client pinned to the repo API version |

`scripts/setup-stripe-local.mjs` and `scripts/validate-stripe-connect.mjs` use
the same guards.

## Lifecycle script

```bash
pnpm stripe:setup     # onboard the seed organiser's Express account (once)
pnpm dev              # webhook/refund/payout steps hit real HTTP routes
pnpm stripe:lifecycle # charge → webhook → refund → payout, both fee structures
```

For each `feeStructure` ("athlete" and "organiser") it:

1. Creates a PaymentIntent mirroring the checkout route and asserts
   `amount` / `application_fee_amount` / `transfer_data.destination`
2. Confirms with a Stripe test card and asserts `succeeded`
3. Forges a **real signed** `payment_intent.succeeded` payload
   (`stripe.webhooks.generateTestHeaderString`) and POSTs it to the running
   `/api/stripe/webhook` — signature verification is exercised for real, no
   Stripe CLI needed
4. Asserts the CONFIRMED Registration rows: `amountCents`, `platformFeeCents`,
   `feeStructure`
5. Refund: athlete `refund-request` → admin `refund` → Stripe refund created +
   registration `REFUNDED`
6. Payout: admin-triggered payout against the connected Express account, asserts
   `payoutTriggered` / `payoutAmountCents` / `payoutAt`, then asserts a retry
   returns 409 with **no double-pay**

Gated assertions (flip on once the fix lands):

- `EXPECT_ORGANISER_NET=1` — hard-assert the organiser payout net equals
  `Σ(amountCents − platformFeeCents)` instead of the current over-pay (issue
  #251). Until then the organiser payout trigger is skipped because the current
  `runPayoutForEvent` pays `Σ amountCents`, which exceeds the connected
  account's balance after the platform fee was withheld — Stripe rejects it.

## Playwright spec

`e2e/stripe-lifecycle.spec.ts` skips entirely when `STRIPE_SECRET_KEY` or
`STRIPE_WEBHOOK_SECRET` is absent. When present it drives the **real
`/api/checkout` route** (which the script bypasses) through confirm → signed
webhook → CONFIRMED → refund, using the `__e2e_bypass` cookies for the refund
endpoints.

Prerequisites to run it locally:

- `.env.local` with `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (test mode)
- Seed organiser `sarah.mitchell@startline.test` Stripe-onboarded
  (`pnpm stripe:setup`)
- Turnstile unconfigured (fails open) or the checkout route rejects

## CI

The e2e workflow (`ci.yml`) exports `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
from the bootstrap secret. When they are absent the spec skips; when present the
seed organiser is not onboarded in CI, so it also skips there — real-Stripe runs
are a local/dev activity. The skip path keeps CI green either way.

## Related

- [Payments — Stripe Connect & Platform Fees](overview.md)
- [Payments overview](index.md)
