---
type: Reference
title: Authentication & Authorisation
description: AWS Cognito-based authentication for the Startline platform — JWT verification, middleware routing, session helpers, and auth bypass modes.
tags: [startline, auth, cognito, jwt, middleware, sessions]
resource: /lib/amplify-server.ts
---

# Auth System

Startline uses **AWS Cognito** for authentication with **JWT verification** via the `jose` library. The only Cognito group is `admins`; authorisation at the record level is handled in Prisma queries.

## Cognito Pool

- Managed via Terraform (per-environment pool in the environment module)
- Production pool with user pool ID and client ID exposed via `NEXT_PUBLIC_COGNITO_USER_POOL_ID` and `NEXT_PUBLIC_COGNITO_CLIENT_ID`
- JWKS endpoint retrieved at runtime from `cognito-idp.{region}.amazonaws.com/{userPoolId}/.well-known/jwks.json`

## Authentication Flow

1. **Sign-in** through `aws-amplify/auth` (client-side in `SignInModal.tsx`) or Cognito Hosted UI
2. Cognito sets cookies: `LastAuthUser` and `{clientId}.{user}.accessToken`
3. **Middleware** (`middleware.ts`) reads these cookies, verifies the access token JWT using `jose`, and protects organiser/admin routes
4. **Server components** use `getServerSession()` from `/lib/amplify-server.ts` to verify tokens and return session info
5. **Client components** use `AuthContext` from `/context/AuthContext.tsx`

## Middleware Route Protection

Protected path lists defined in `middleware.ts`:

- **`ORGANISER_PROTECTED`**: `/organiser/dashboard`, `/organiser/listings`, `/organiser/profile`, `/organiser/new-listing`, `/organiser/onboarding`, `/organiser/payments`, `/organiser/events`
- **`ADMIN_PROTECTED`**: `/admin/dashboard`, `/admin/events`, `/admin/organisers`, `/admin/reviews`

Unauthenticated access to these paths redirects to `startlineau.com`.

## Multi-Factor Authentication + Passkeys

MFA is **optional** for all users and **required for admins** (seed sets admin MFA preference). Only TOTP authenticator app is supported (no SMS).

### Auth Flow Types

| Flow | Method | Second Factor |
|---|---|---|
| Password (`USER_SRP_AUTH`) | Email + password | TOTP (if enabled) |
| Passkey (`USER_AUTH`) | Biometric/PIN via WebAuthn | None (first factor skips second) |

Passkey sign-in passes `options: { authFlowType: "USER_AUTH", preferredChallenge: "WEB_AUTHN" }` to `signIn()`. The default `authenticationFlowType: "USER_SRP_AUTH"` in `lib/amplify-config.ts` stays unchanged — passkey overrides per-call.

### Terraform Configuration

Environment module sets:
- `mfa_configuration = "OPTIONAL"`
- `software_token_mfa_configuration { enabled = true }`
- `ALLOW_USER_AUTH` in `explicit_auth_flows`

## Auth Bypass

Two independent bypass mechanisms:

### Legacy Bypass (no Cognito pool)
When `NEXT_PUBLIC_COGNITO_USER_POOL_ID` is unset and `NODE_ENV=development`, bypass activates automatically. Hard-codes session as:
- sub: `dev-bypass-organiser`, email: `sarah.mitchell@startline.test`, groups: `["admins"]`

### E2E Cookie Bypass
For Playwright tests, a `__e2e_bypass=1` cookie provides auth-free access to protected routes. Set via `page.context().addCookies()`. Works in middleware, `getServerSession()`, and `AuthContext`. Only works in `NODE_ENV=development`. Used by `adminLogin()` and `organiserLogin()` helpers in `e2e/helpers.ts` to avoid Cognito dependency and TOTP challenges.

## Session Types

`/lib/amplify-server.ts` defines four session types:

| Type | Fields | Use Case |
|---|---|---|
| `ServerSession` | sub, email, groups, phoneNumber?, birthdate? | Raw Cognito token payload |
| `UserSession` | sub (User.id), email, name, phoneNumber?, birthdate? | Athlete site |
| `OrganiserSession` | sub (Organiser.id), email, status, verified | Organiser portal |
| `AdminSession` | sub (Admin.id), email, name | Admin portal |

## Seed Users

Defined in `/prisma/seed.ts`. All share password `Password123!`. See the full roster — names, emails, organiser roles, and E2E bypass cookies — in [Seed Users](seed-users.md).

## Athlete Account Creation

When a guest registers for an event, an athlete Cognito user is created automatically via `/lib/athlete-accounts.ts`. This uses `AdminCreateUser` with a suppressed temporary password, so the athlete can set their password on first login.

## Related

- [Architecture](/openwiki/architecture/overview.md) — how middleware routes and protects portals
- [Domain & Data Model](/openwiki/domain/data-model.md) — User, Admin, and Organiser entities
