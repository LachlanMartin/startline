# Startline

Next.js 15 (App Router) fitness event discovery platform. Three portals:

| Route | Domain | Purpose |
|---|---|---|
| `(user)/` | startlineau.com | Public event browsing |
| `organiser/` | organiser.startlineau.com | Event management |
| `admin/` | admin.startlineau.com | Approvals, org management |

## Development

- **Package manager:** pnpm 11.11.0
- **Dev:** `pnpm dev` (Turbopack). **Build:** `pnpm build` (standalone `next.config.ts`). `@/*` → root.
- **Docker:** PostgreSQL 15 on :5432 + Mailpit (SMTP :1025, UI :8026). Start: `docker compose up -d` on main checkout only.
- **Worktree?** `git worktree list`. If worktree, Docker infra runs on main checkout — just `pnpm dev`, never `docker compose up`.
- **Env vars:** Loaded from `.env.local` (gitignored). See `.env.example` + `terraform/` for setup steps.

## Environment variables

Secrets in AWS Secrets Manager. `.env.local` at repo root (gitignored).

| Secret | Contents |
|---|---|
| `startline/ci-bootstrap` | CI/CD bootstrap tokens |
| `startline/prod/app` | Prod env vars (Cognito, Stripe live, S3) |
| `startline/staging/app` | Staging env vars (non-prod Cognito, RDS, S3) |

**Setup:** `cp main-checkout/.env.local .env.local` in each worktree. Override `DATABASE_URL` to local Docker (`postgresql://postgres:postgres@localhost:5432/startline?schema=public`) if not using staging RDS.

## Auth (Cognito)

JWT verification in `middleware.ts` via `jose`. Tokens in Cognito-managed cookies. Only Cognito group: `admins`. Authorisation at DB level (Prisma).

### Account model

Every user has a **User** record (created on first login). Users can create an **Organiser** profile (1:1). Organiser records can be verified (auto-publish events) or unverified (admin approval needed). See `lib/amplify-server.ts` for session helpers (`ServerSession`, `UserSession`, `OrganiserSession`, `AdminSession`).

All seed users share password `Password123!`.

| Email | Notes |
|---|---|
| `admin@startline.test` | Admin (`admins` group), MFA enabled in seed |
| `organiser@startline.test` | User + Organiser (Apex Endurance Events, verified) |
| `user@startline.test` | User only |

Old Cognito users from previous seeds not auto-removed — delete manually or via Terraform reset.

`middleware.ts` routes by hostname in production. Dev mode (`NODE_ENV=development`) skips all domain checks — everything at `localhost:3000`. Protects path lists: `ORGANISER_PROTECTED`, `ADMIN_PROTECTED`.

### MFA + Passkeys

- **TOTP authenticator app** via Cognito (OPTIONAL, software token MFA). Admin seed user has MFA preference enabled.
- **Passkey** (`WEB_AUTHN`) via `authFlowType: "USER_AUTH"` — passkey sign-in in `SignInModal.tsx` passes `options: { authFlowType: "USER_AUTH", preferredChallenge: "WEB_AUTHN" }`.
- Passkey = first factor that **skips second factor**. Password login still uses `USER_SRP_AUTH`.
- Recovery codes: AES-256-GCM encrypted, stored in `User.recoveryCodes`. Managed via `lib/recovery-codes.ts` and `app/api/user/mfa/route.ts`.
- Recovery codes removed — passkey sign-in or password reset are the recovery paths.
- Security settings at `/settings/security` for users.

## Design system

**`design/design.md`** is authoritative.

Non-negotiables:
- **Dark only.** `color-scheme: dark`. Signal green `#B3E153` (`--color-primary`) only brand hue.
- **Chakra Petch for structure, Inter for prose.** Structural chrome = uppercase + wide tracking.
- **No emoji. Lucide line icons only.**
- **Text on `#B3E153` is always `#141414` (dark ink).**
- **"Machined" shadow** `box-shadow: 2px 2px 0 #B3E153` on single primary CTA per view.
- **Status labels:** `APPROVED` renders as "Published" to organisers.

shadcn/ui components via `npx shadcn@latest add <component>`. Use `cn()` from `lib/utils.ts`.

## Testing

```
pnpm lint              # ESLint — 0 errors (warnings OK for <img> on QR codes)
pnpm test              # Vitest unit tests (77 tests, 8 files)
pnpm test:watch        # Vitest watch mode
pnpm test:e2e          # Playwright (needs Docker PostgreSQL + dev server)
```

- Unit tests: `src/__tests__/`. E2E: `e2e/`.
- **Every new feature MUST include E2E tests.**
- Playwright config: auto-starts dev server, `reuseExistingServer: true`, 1 retry, Chromium only.

### E2E auth bypass

Admin and organiser E2E tests use a `__e2e_bypass` cookie instead of real Cognito login. The cookie is set by `adminLogin()` and `organiserLogin()` helpers in `e2e/helpers.ts`. This avoids TOTP challenges and Cognito dependency.

| Test file | Auth method | Needs Cognito? |
|---|---|---|
| `admin.spec.ts` | Cookie bypass | No |
| `organiser.spec.ts` | Cookie bypass | No |
| `auth.spec.ts` (signup) | Real Cognito (`hasCognito` guard) | Yes |
| `auth.spec.ts` (modal UI) | None | No |
| `mfa.spec.ts`, `checkout.spec.ts`, etc. | None | No |

The bypass works in middleware, `getServerSession()`, and `AuthContext` via `document.cookie.includes("__e2e_bypass=1")`. No env var needed.

**Run E2E without Cognito:** `npx playwright test` — 93+ tests pass, 2 auth signup tests skip.

### Pre-commit gate

```bash
npx prisma generate            # required before typecheck
pnpm lint        # 0 errors
pnpm typecheck   # 0 errors
pnpm test        # all pass
pnpm test:e2e    # all pass (needs Docker PostgreSQL)
```

## GitHub

Use `gh` CLI — **not** GitHub MCP (fails for this private org repo).

**`main` and `prod` are protected.** Always PR, never push directly.

PR conventions: scan open issues, link with `Closes #N`. Follow `.github/PULL_REQUEST_TEMPLATE.md`. CI runs are informational, non-blocking.

Configured in `opencode.json`: stripe, resend, aws, cloudflare.

## Terraform + CI/CD

Infra in `terraform/`. Unified state. Only `main` triggers Terraform apply.

| Workflow | Trigger | Scope |
|---|---|---|
| `terraform-plan.yml` | PR to `main` | Plan both environments |
| `terraform-apply.yml` | Push to `main` | Apply both environments |

Environments:

| Env | Branch | Build |
|---|---|---|
| `prod` | `prod` | Migrate, no seed |
| `staging` | `main` | Migrate + seed |

`ci.yml` runs lint/typecheck/build/test/e2e on PRs (non-blocking). Deploys via `deploy.yml` to Amplify.

## README accuracy

`README.md` has known inaccuracies. Cross-reference with AGENTS.md and codebase:
- **License:** README says MIT, actual is All Rights Reserved.
- **`.envrc`:** README says it exists at root — it's gitignored, devs use direnv + local config.
- **Scripts:** README table missing `typecheck`, `prisma:generate`, `test:watch`, `stripe:*`, `start`, `test:registration`, `staging:db:start`.
- **Site state:** README describes live platform; site is in waitlist mode.
- **Admin domain:** README implies shared domain; admin is now `admin.startlineau.com`.

## OpenWiki

Recurring code documentation. Start at `openwiki/quickstart.md`. Generated by scheduled GitHub Actions workflow — hand-edit `openwiki/` files directly if docs need updating, the workflow refreshes the wiki from these.
