---
type: Reference
title: Seed Users
description: Database seed users for local development and E2E testing — emails, passwords, organiser roles, and auth bypass identities.
tags: [startline, auth, seed, testing, users, organisers]
resource: /prisma/seed.ts
---

# Seed Users

Populated by `prisma db seed` (`/prisma/seed.ts`). All accounts share the same password:

| Password |
|---|
| `Password123!` |

## Organiser members

People who manage an organiser on the platform.

| Name | Email | Role | Organisation |
|---|---|---|---|
| Sarah Mitchell | sarah.mitchell@startline.test | Owner | Apex Endurance Events |
| Tom Whitfield | tom.whitfield@startline.test | Manager | Apex Endurance Events |
| Jack O'Brien | jack.obrien@startline.test | Manager | Apex Endurance Events |
| Priya Sharma | priya.sharma@startline.test | Manager | Apex Endurance Events |
| Jade Nguyen | jade.nguyen@startline.test | Owner | Coastal Fitness Collective |
| Chloe Bennett | chloe.bennett@startline.test | Manager | Coastal Fitness Collective |
| Liam O'Connor | liam.oconnor@startline.test | Manager | Coastal Fitness Collective |

> Roles: exactly one **Owner** per organiser (full control: members, ownership, deletion). **Managers** handle content (events, profile).

## Platform admin

| Name | Email | Notes |
|---|---|---|
| Marcus Stirling | marcus.stirling@startline.test | `admins` Cognito group, MFA (TOTP) enabled |

## Athletes (no organisation membership)

| Name | Email |
|---|---|
| Harper Jones | harper.jones@startline.test |
| Mateo Silva | mateo.silva@startline.test |
| Aria Kapoor | aria.kapoor@startline.test |
| Oscar Ngata | oscar.ngata@startline.test |
| Sophie Moreau | sophie.moreau@startline.test |
| Lucas Tan | lucas.tan@startline.test |

## E2E bypass cookies

For local testing without Cognito, set a `__e2e_bypass` cookie (dev mode only) to impersonate a seeded identity.

| Cookie value | Identity | Portal role |
|---|---|---|
| `organiser` | Sarah Mitchell | Apex Owner |
| `member` | Tom Whitfield | Apex Manager |
| `user` | Jade Nguyen | Coastal Owner |
| `admin` | Marcus Stirling | Platform Admin |
