# Secret Scan Report

Date: 2026-08-11 · Branch: `security/secret-scan` · 583 commits scanned

**Verdict: no real leaks. Nothing needs rotating.**

Scanned with `gitleaks` (working tree + full git history) and a manual
pattern scan over all 2,671 unique blobs in history (AWS AKIA/ASIA, Stripe
sk/pk/whsec, Resend `re_`, Mapbox `pk./sk.eyJ`, private keys, GitHub tokens,
GCP `AIza`, service accounts, `.env*`, `*.tfstate`).

## 1. gitleaks: 264 hits — all false positives

| Rule | File | Commits | Class |
|---|---|---|---|
| `jwt` ×264 | `.cognito/db/local_1zg1VuY1.json` | `5881cb5`, `7f5046d`, `db3bd05` (added) → `1960542` (deleted) | **TEST** |

This is the **cognito-local emulator** database used before the migration to
real AWS Cognito. Contains local-dev refresh tokens (issuer
`http://localhost:9229/local_1zg1VuY1`), all expired, signed by an ephemeral
local key that is **not** in the repo (no private key present in the blob).
Useless against production: `middleware.ts:55` verifies tokens only against
`cognito-idp.ap-southeast-2.amazonaws.com` JWKS.

The same file also stores plaintext seed password `Password123!` — that's the
known dev seed cred documented in AGENTS.md. Not a secret.

File was deleted in `1960542` and `/\.cognito\//` is in `.gitignore:59`.
Nothing to do.

## 2. Manual history scan: no real credentials ever committed

- Every `.env.example` blob in history uses redacted placeholders (`AKIAXXXXXXXXXXXXXXXX`, `sk_test_xxxxxxxx…`, `re_xxxxxxxx…`). Verified by decoding 14 distinct versions.
- Never committed in history: `.env.local`, `.env.production`, `*.tfstate`, `*.pem`, private keys, service-account JSON, `sk_live_`, `re_`, `whsec_`, `sk.eyJ` (Mapbox secret), GitHub/`ghp_` tokens.
- Only non-placeholder secret-shaped values found:
  - **Stripe PaymentIntent `client_secret`** → passed server→browser for Stripe Elements (`app/api/checkout/route.ts:260`, `ReviewPayStep.tsx`). **Expected** — per-payment, short-lived, needs to reach the client.
  - **Seed org slugs** matched a loose Cognito-client regex — FPs.

## 3. Keys that reach the browser (NEXT_PUBLIC_*)

All NEXT_PUBLIC_ values are **public by design** — required client-side, none are credentials. Listed for completeness:

| Var | Used in | Public value type |
|---|---|---|
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | `middleware.ts`, `amplify-*.ts` | pool ID (public) |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | `middleware.ts`, `AmplifyProvider.tsx` | app client ID (public) |
| `NEXT_PUBLIC_AWS_REGION` | `middleware.ts`, `amplify-server.ts` | region |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | `EventMap.tsx`, `LocationPreviewMap.tsx` | `pk.*` public token |
| `NEXT_PUBLIC_MAPBOX_STYLE_URL` | same | style URL |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `ReviewPayStep.tsx` | `pk_test_*` public |
| `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_BASE_URL` | `email.ts`, share links | URLs |
| `NEXT_PUBLIC_CDN_URL` | `app/api/upload/route.ts:83` | CDN origin |
| `NEXT_PUBLIC_AUTH_BYPASS` | `middleware.ts:72`, `amplify-server.ts:63` | auth flag ⚠️ |

### ⚠️ `NEXT_PUBLIC_AUTH_BYPASS` — flag, not secret
Set to `true` on Amplify **PR previews** (`terraform/main.tf:70`). Public flag,
but harmless in prod: the bypass branch requires `noCognito` (pool ID unset,
`middleware.ts:70-72`), and prod always has the pool configured. Server-read
only — the client cannot flip it. No action, but do not remove the `noCognito`
guard.

### Server-only vars — verified never in client code
`DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`RESEND_API_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
`GUEST_EMAIL_VERIFICATION_SECRET`, `ABR_GUID` — grep of all `'use client'`
files shows **zero** references to non-`NEXT_PUBLIC_` env vars. Access stays
server-side via route handlers / `lib/s3.ts`. No code change required.

## 4. ROTATE-ME list

**Empty.** Nothing real leaked into the working tree or git history. The only
historical hits are an expired local-dev emulator DB (deleted + gitignored)
and `.env.example` placeholders.

## Hygiene notes (optional, no urgency)

1. Consider `gitleaks` in CI (blocking on `jwt`/`generic-api-key` rules, not
   `Password123!`-style seeds) so this stays verified.
2. `STRIPE_WEBHOOK_SECRET` and `ABR_GUID` are committed-adjacent in
   `.env.example` as empty/`x` placeholders — keep them that way, never fill
   real values there.
