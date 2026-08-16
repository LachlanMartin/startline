---
type: Reference
title: Architecture
description: Three-portal architecture of the Startline platform — athlete site, organiser portal, and admin portal — built with Next.js 15 App Router and hosted on AWS Amplify.
tags: [startline, architecture, nextjs, app-router, portals, aws-amplify]
resource: /middleware.ts
---

# Architecture Overview

Startline uses a single Next.js 15 codebase with **three portals** served under different domains via middleware-based routing.

## Portal Structure

| Portal | Domain | App Route Directory | Purpose |
|---|---|---|---|
| **Athlete Site** | `startlineau.com` | `/app/(user)/` | Public event browsing, search, registration, reviews |
| **Organiser Portal** | `organiser.startlineau.com` | `/app/organiser/` | Event management, onboarding, listings, payments, dashboard |
| **Admin Portal** | `admin.startlineau.com` | `/app/admin/` | Event approval, organiser management, analytics, audit log |

The organiser landing page (`/organiser-landing/`) is served at the root of the organiser domain via URL rewriting in `middleware.ts`.

## Domain Routing

Routing between portals is handled by [middleware.ts](/middleware.ts). In **production**, the middleware inspects the `Host` header and routes requests accordingly:

- `startlineau.com` → athlete site (default). Pre-launch, all paths are rewritten to the `/waitlist` landing page (except `/api/waitlist` and static assets).
- `organiser.startlineau.com` → organiser portal, with `/` rewritten to `/organiser-landing`
- `admin.startlineau.com` → admin portal, with unauthenticated access redirected to `/admin/login`

Protected paths (defined in `ORGANISER_PROTECTED` and `ADMIN_PROTECTED` arrays) require valid Cognito JWT tokens. Admin routes additionally verify the user belongs to the `admins` Cognito group.

In **development mode** (`NODE_ENV=development`), all domain checks are skipped and everything runs on `localhost:3000`. Local dev and E2E tests use the `__e2e_bypass` cookie to authenticate without Cognito — this is disabled outside development. With no Cognito pool configured, `NEXT_PUBLIC_AUTH_BYPASS=true` additionally unlocks a legacy bypass for PR previews on Amplify.

## Hosting & Build

- **Hosting**: AWS Amplify with `standalone` output mode (`next.config.ts`)
- **Build spec**: Defined in Terraform (`terraform/main.tf`) — runs `pnpm install`, `prisma generate`, fetches secrets from AWS Secrets Manager, runs migrations, seeds (non-prod only), then builds
- **Output**: Standalone `.next` directory deployed by Amplify

## Key Infrastructure Components

- Docker Compose for local development: PostgreSQL 15 (`:5432`), Mailpit (SMTP `:1025`, UI `:8025`), app (`:3000`), Prisma Studio (`:5555`)
- Git worktrees for parallel development — Docker infra runs on the main checkout only
- Content security policy configured in `next.config.ts` — Stripe scripts white-listed

## Related

- [Auth System](/openwiki/auth/overview.md) — how middleware protects routes with Cognito
- [Domain & Data Model](/openwiki/domain/data-model.md) — entities that flow through the portals
- [Infrastructure & CI/CD](/openwiki/infrastructure/terraform.md) — Terraform provisioning and deployment
