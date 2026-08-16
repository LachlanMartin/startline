---
type: Reference
title: Startline — Quickstart
description: Entrypoint to the Startline fitness event discovery platform documentation. Covers architecture, domain model, auth, payments, infrastructure, and design system.
tags: [startline, quickstart, overview, fitness-events, australia]
---

# Startline Platform Documentation

**Startline** helps performance-driven fitness individuals discover competitive events across Australia. It is a three-portal web platform for athletes, event organisers, and administrators.

## What This Docs Cover

- [Architecture Overview](/openwiki/architecture/overview.md) — Three-portal structure, Next.js App Router, domain routing, hosting
- [Domain & Data Model](/openwiki/domain/data-model.md) — Prisma schema, entity relationships, event lifecycle
- [Auth System](/openwiki/auth/overview.md) — AWS Cognito, JWT verification, middleware, session helpers
- [Payments](/openwiki/payments/overview.md) — Stripe Connect Express, platform fees, checkout, capacity management
- [Infrastructure & CI/CD](/openwiki/infrastructure/terraform.md) — Terraform, AWS Amplify, environments, deployments
- [Design System](/openwiki/design-system/overview.md) — Dark theme, tokens, typography, components, brand voice

## Quick Facts

| Property | Detail |
|---|---|
| **Stack** | Next.js 15 (App Router, Turbopack), TypeScript |
| **Database** | PostgreSQL 15 + Prisma ORM (v7) |
| **Auth** | AWS Cognito with JWT verification (jose) |
| **Payments** | Stripe Connect Express |
| **Email** | Resend (production), Mailpit (local dev) |
| **Hosting** | AWS Amplify |
| **Infra** | Terraform (unified state) |
| **CI/CD** | GitHub Actions |

## Three Portals

- **Athlete Site** (`startlineau.com`) — Public event browsing, search, registration, reviews. **Pre-launch, the user domain is rewritten to the `/waitlist` landing page.**
- **Organiser Portal** (`organiser.startlineau.com`) — Event management, onboarding, payments, registrations
- **Admin Portal** (`admin.startlineau.com`) — Approval workflows, organiser management, analytics, audit

Domain routing is handled by `middleware.ts` in production. In development mode, everything runs on `localhost:3000` with auth bypass available.

## Source Map

| Area | Key Directories |
|---|---|
| App routes | `/app/(user)/`, `/app/organiser/`, `/app/admin/` |
| API routes | `/app/api/` — checkout, events, organiser, admin, register, stripe |
| Library | `/lib/` — auth, events, platform fee, registration, email, S3, stripe |
| Prisma schema | `/prisma/schema.prisma` |
| Tests | `/src/__tests__/` (unit), `/e2e/` (Playwright) |
| Infrastructure | `/terraform/` |
| CI/CD | `/.github/workflows/` |
| Design | `/design/design.md` |
| Email templates | `/emails/` (React Email) |

## Backlog

- **Guest registration flow** — `/lib/guest-email-verification.ts` and related API routes are fully implemented but the documentation cross-references are light; see `/app/api/register/verify-email/`.
- **Analytics module** — `/app/admin/analytics/` exists but is not yet documented in depth; see `/app/api/admin/analytics/route.ts`.
- **Waitlist flow** — `/app/waitlist/` and `/app/api/waitlist/` exist for pre-launch signups but are not documented separately.
- **Security hardening** — server-side Zod validation, Postgres rate limiting (`lib/rate-limit.ts`), Cloudflare Turnstile bot protection (`lib/turnstile.ts`), and the admin security console (`/app/admin/security/`) are implemented but not documented in depth; see `app/api/**` and the `RateLimit`/`SecurityEvent` Prisma models.
