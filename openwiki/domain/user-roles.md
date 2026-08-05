---
type: Reference
title: User Roles & Permissions
description: The four account types on Startline — User, Manager, Owner, and Admin — how they authenticate, what they can do, and how organiser roles are granted.
tags: [startline, auth, roles, permissions, users, organisers, admin]
resource: /prisma/schema.prisma
---

# User Roles & Permissions

Startline has **four account types**. `User`, `Manager`, and `Owner` are all the same `User` model — the difference is whether they hold an `OrganiserMember` row and which `OrganiserRole` it carries. `Admin` is a separate model for platform staff.

| Role | Model | Portal | Scope |
|---|---|---|---|
| **User** | `User` | Public site | Browsing, registering, personal profile |
| **Manager** | `User` + `OrganiserMember` (MANAGER) | Organiser portal | Content on one organiser |
| **Owner** | `User` + `OrganiserMember` (OWNER) | Organiser portal | Full control of one organiser |
| **Admin** | `Admin` | Admin portal | The whole platform |

## How roles are granted

Every `User` starts as a **User**. Organiser access is granted via `OrganiserMember`, created either:

- automatically when a user creates an Organiser through onboarding (the creator becomes the **Owner**), or
- by an existing Owner adding them by email (they join as a **Manager**).

A user can belong to **zero or more** organisers (hard cap: 5). One user can be a Manager on one organiser and an Owner on another — the role is per-organiser.

Only `Admin` authenticates differently: it is derived from the Cognito `admins` group, not from `OrganiserMember`.

## Permissions by role

### User

- Browse and search events
- Register for events (via Startline checkout or external link)
- Save events, follow organisers
- Maintain a public profile and race history
- Request a refund on an upcoming registration

### Manager (`OrganiserMember.role = MANAGER`)

Everything a User can do, plus, **on the organiser(s) they manage**:

- Create, edit, and delete events
- Edit the organiser profile
- Manage registrations, start waves, bibs, and race results
- View analytics and notifications
- Handle refund requests

Cannot manage members, transfer ownership, or delete the organiser.

### Owner (`OrganiserMember.role = OWNER`)

Everything a Manager can do, plus, on their organiser:

- Add and remove members
- Transfer ownership to another member (atomically demotes themselves to Manager)
- Delete the organiser

Every organiser has **exactly one Owner** — enforced in app logic, not the DB. The last Owner can never be removed or demoted.

### Admin (`admins` Cognito group)

Platform-wide access via `admin.startlineau.com`:

- Approve/reject/verify events and organisers
- Manage users (edit profiles, ban, edit email)
- View registrations, reviews, analytics, payouts, and the audit log
- Read-only visibility into each organiser's member roster

Admins do **not** hold `OrganiserMember` rows and cannot act inside an organiser's portal.

## Role hierarchy

```
Admin (platform)          ← whole platform
  Owner (per organiser)   ← full control of one organiser
    Manager (per organiser) ← content on one organiser
      User                ← personal account
```

## Data model

- `User` — personal account (`users` table)
- `Organiser` — brand entity managed via memberships (`organisers` table)
- `OrganiserMember` — junction `{ organiserId, userId, role }`, `role ∈ { OWNER, MANAGER }` (`organiser_members` table)
- `Admin` — platform staff (`admins` table), from Cognito `admins` group

See [Domain and Data Model](data-model.md) for the full Prisma schema.
