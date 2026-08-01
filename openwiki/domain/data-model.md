---
type: Reference
title: Domain and Data Model
description: Prisma ORM data model for the Startline fitness event platform — covering users, organisers, events, registrations, reviews, and admin accounts.
tags: [startline, data-model, prisma, database, schema, entities]
resource: /prisma/schema.prisma
---

# Domain & Data Model

The data layer uses **Prisma ORM v7** against **PostgreSQL 15**. The schema is defined in [`/prisma/schema.prisma`](/prisma/schema.prisma) and targets `rhel-openssl-3.0.x` for AWS Lambda/RHEL compatibility.

## Core Entities

### User (`users`)
Every platform user has a User record, created on first Cognito login. Users can optionally create an Organiser profile (1:1). Fields include name, username (public handle), bio, profile picture, city/state (for map centering), ban status, and MFA toggle (`mfaEnabled`).

### Organiser (`organisers`)
Linked 1:1 to a User. Holds business-specific fields:
- **Profile**: org name, contact info, ABN, website, social links, bio, logo, cover image, photos
- **Legal**: legal name, Date of Birth (for ATO SERR reporting), insurance declaration
- **Stripe**: Stripe Connect Express account reference and onboarding completion status
- **Status**: `APPROVED` or `SUSPENDED`
- **Verification**: Verified organisers can auto-publish events; unverified ones need admin approval

### Admin (`admins`)
Admin accounts are created on first Cognito login for users in the `admins` Cognito group. They have access to the admin portal and are referenced by audit logs and event reviews.

### Event (`events`)
The central entity. Each event belongs to one Organiser and passes through a lifecycle (see below). Key fields by creation step:
1. **Basics**: title, discipline, tagline, description
2. **Date & Location**: eventDate, endDate, startTime, endTime, venue, address, city, state, latitude, longitude
3. **Format & Categories**: format (individual/team/both), level (open/beginner/elite), categories (JSON), cap, minAge
4. **Tickets**: waves (JSON array of ticket tiers), inclusions, extras, refund policy, registration type, fee structure (athlete/organiser absorbs platform fee)
5. **Media & Logistics**: cover image, photos, registration URL, bag drop, parking, accessibility info

Events can be **pinned** by admins for featured placement.

### Registration (`registrations`)
One row per athlete entry into an event. OrganiserId is denormalised from the event for efficient queries. Key fields:
- **Athlete info**: name, email, DOB, gender, mobile, emergency contact, medical notes, waiver
- **Ticket details**: category, waveLabel, amountCents (integer AUD), platformFeeCents, feeStructure
- **Status**: `CONFIRMED`, `CANCELLED`, `REFUNDED`
- **Payment**: Stripe PaymentIntent ID

Supports group registration (up to 10 participants per checkout via `MAX_REGISTRATION_PARTICIPANTS`).

### Review (`reviews`)
Athlete reviews of **organisers** (required) with an overall rating (1–5) plus optional atmosphere, organisation, and experience sub-ratings. Each review optionally links to one of the organiser's approved events (title denormalised into `eventTitle`). Reviews are authored by signed-in users (`userId`, with `reviewerName` derived from their display name). `isPublished` controls public visibility (new reviews are created published), while `isVerified` marks verified reviews (not set on creation).

### OrganiserFollow (`organiser_follows`)
Junction table linking a User to an Organiser they follow, with a `@@unique([userId, organiserId])` constraint preventing duplicates. Public follow counts and organiser stats (registrations, followers, events hosted) are aggregated in [`/lib/organiser-follows.ts`](/lib/organiser-follows.ts). A public follow/unfollow API is exposed at `/app/api/public/organisers/[id]/follow/route.ts`.

### Supporting Entities
- **Notification**: Organiser notifications for event approvals, rejections, and new registrations
- **Announcement**: Per-event organiser announcements to registrants
- **AdminAuditLog**: Admin action audit trail (action, target type/ID, JSON metadata)
- **GuestEmailVerification**: Email verification codes for guest (non-logged-in) registrations
- **WaitlistSubscriber**: Pre-launch email signups

## Event Lifecycle

Events move through these statuses:

```
DRAFT ──(submit)──> PENDING ──(admin approve)──> APPROVED
                         │                            │
                    (admin reject)                (past date)
                         │                            │
                      REJECTED                    ARCHIVED
                                                     ↑
                                            (organiser archives)
```

- **DRAFT**: Saved but not submitted for review
- **PENDING**: Submitted, awaiting admin review
- **APPROVED**: Live on the platform (visible to athletes)
- **REJECTED**: Denied by admin with optional rejection reason
- **ARCHIVED**: Past events or organiser-archived

Archival happens automatically for past-dated events via `archivePastEvents()` in `/lib/archive-events.ts`, called by `getAllEvents()`.

## Key Business Rules

- **Capacity**: Per-event cap and per-tier (wave) caps. Checked at checkout via `/lib/registration-capacity.ts`. Only confirmed (paid) registrations count against limits.
- **Platform fee**: 3.95% + $1.45 AUD per registration. The `feeStructure` field on both Event and Registration determines whether the athlete or organiser absorbs it.
- **Age check**: Minimum registration age is 18 (`MIN_REGISTRATION_AGE`). Validated in `/lib/registration-form.ts`.
- **ABN lookup**: Australian Business Register integration via `/lib/abn.ts` for organiser onboarding.
- **Guest registration**: Athletes can register without an account. Email verification required via `/lib/guest-email-verification.ts`.
- **Prize pool**: Stored in the `extras` field as a serialised string; parsed by `/lib/prize-pool.ts`.

## Related

- [Auth System](/openwiki/auth/overview.md) — how User/Admin/Organiser accounts are created and authenticated
- [Payments](/openwiki/payments/overview.md) — how Registration pricing and Stripe payments work
- [Architecture](/openwiki/architecture/overview.md) — how entities flow through the three portals
