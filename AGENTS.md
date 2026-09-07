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
- **Per-worktree DB:** run `./scripts/dev-db.sh` on first use of a new worktree (creates an isolated `startline_<branch>` DB, applies migrations, points `.env.local` at it). Then **always run `pnpm prisma:seed`** — skip only if you specifically need an empty DB.
- **Env vars:** Loaded from `.env.local` (gitignored). See `.env.example` + `terraform/` for setup steps.

## Environment variables

Secrets in AWS Secrets Manager. `.env.local` at repo root (gitignored).

| Secret | Contents |
|---|---|
| `startline/ci-bootstrap` | CI/CD bootstrap tokens |
| `startline/prod/app` | Prod env vars (Cognito, Stripe live, S3) |
| `startline/staging/app` | Staging env vars (non-prod Cognito, RDS, S3) |

**Setup:** `cp main-checkout/.env.local .env.local` in each worktree. Override `DATABASE_URL` to local Docker (`postgresql://postgres:postgres@localhost:5432/startline?schema=public`) if not using staging RDS.

### Runtime vs build-time variables

`next.config.ts` sets `output: "standalone"` and the Amplify build ships only
`.next`, so the `.env.production` that preBuild writes from Secrets Manager
never reaches the server. Secrets Manager therefore covers build time only.

* `NEXT_PUBLIC_*` is fine there, because Next inlines it during `pnpm build`.
* Anything the server reads at runtime (`STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`,
  `TURNSTILE_SECRET_KEY`, `GUEST_EMAIL_VERIFICATION_SECRET`, `ABR_GUID`,
  `DATABASE_URL`, `UPLOADS_BUCKET`, `CDN_URL`) has to be an Amplify **branch**
  environment variable. Terraform sets those in
  `terraform/modules/environment/main.tf`.

Terraform owns the whole branch variable map, so a value added by hand in the
Amplify console is deleted on the next apply. Add new runtime secrets to the
`startline/ci-bootstrap` secret instead — `stripe_secret_key_prod`,
`stripe_secret_key_staging`, `stripe_webhook_secret_prod`,
`stripe_webhook_secret_staging`, `resend_api_key`, `resend_from`, `abr_guid`.
A prod apply fails its precondition rather than silently clearing a missing one.

## Uploads

**File bytes must never pass through a route handler on a deployed
environment.** Amplify runs on `platform = "WEB_COMPUTE"`, which is Lambda
backed, and a multipart request body is base64-encoded into the invocation
payload. The 6 MB payload ceiling therefore lands just under **4.5 MB of actual
file**, well below the 10 MB `lib/upload-limits.ts` allows. Anything in between
is rejected by the platform before the handler runs, and the reply is a **413
with a zero-length body**, so the client cannot even read a reason off it.

`pnpm upload:probe [base-url]` measures this against a deployed environment
(staging by default). It needs no credentials: an unauthenticated POST that
reaches the handler answers `401` with JSON, so the status says which layer
replied. Measured on staging:

```
 4.30 MB -> 401  reached our handler
 4.50 MB -> 413  killed by the platform, empty body
```

The probe also checks that `/api/upload/presign` exists, which is the real
regression test. **A 404 there means the environment is proxying uploads again
and anything over ~4.5 MB will fail.** It exits non-zero on either failure, so
it can gate a deploy.

The browser uploads straight to S3 instead:

| Step | Endpoint | Does |
|---|---|---|
| 1 | `POST /api/upload/presign` | Authenticates, checks type/MIME/size, signs a POST scoped to `uploads/{sub}/{type}/{uuid}.{ext}` |
| 2 | `POST` to the S3 URL | Browser sends the bytes. No size ceiling |
| 3 | `POST /api/upload/complete` | Ranged GET of the first 16 bytes, magic-byte check, deletes the object if it fails |

`lib/upload-client.ts` (`uploadFile`) drives all three and is the only thing
UI should call. `/api/upload` still exists and still reads bytes itself, but
only serves local dev and the Docker image, where there is no bucket — presign
answers `{mode:"proxy"}` and the client falls back to it.

Two things break this silently if forgotten:

- **CSP.** `connect-src` in `next.config.ts` must list the S3 origin. Without
  it the browser blocks the upload and nothing reaches the server logs.
- **Bucket CORS.** `bucket_cors_allowed_origins` in `terraform/main.tf` must
  cover the portal origins. Prod lists the three domains; staging is `*`.

Step 3 is not optional. Direct-to-S3 means the server never sees the bytes in
flight, so it is the only remaining check that a file matching an image
Content-Type is actually an image.

## Portals and hostnames

Production splits the three portals across `startlineau.com`,
`organiser.startlineau.com` and `admin.startlineau.com`. Every other deployment
(Amplify branch domain, PR previews, local dev) serves all three from one host.
Cross-portal links must go through `lib/portal-domains.ts` so they stay relative
on single-host deployments and absolute in production; hardcoding either shape
breaks one of the two (issue #302).

Cognito cookies are scoped to `.startlineau.com` in `components/AmplifyProvider.tsx`
so a single sign-in covers all three portals. Host-only cookies left the
organiser portal permanently signed out in production.

## Auth (Cognito)

JWT verification in `middleware.ts` via `jose`. Tokens in Cognito-managed cookies. Only Cognito group: `admins`. Authorisation at DB level (Prisma).

### Account model

Every user has a **User** record (created on first login). Users can create an **Organiser** profile (1:1). Organiser records can be verified (auto-publish events) or unverified (admin approval needed). See `lib/amplify-server.ts` for session helpers (`ServerSession`, `UserSession`, `OrganiserSession`, `AdminSession`).

All seed users share password `Password123!`.

| Email | Notes |
|---|---|
| `marcus.stirling@startline.test` | Admin (`admins` group), MFA enabled in seed |
| `sarah.mitchell@startline.test` | User + Organiser (Apex Endurance Events, verified) |
| `jade.nguyen@startline.test` | User only |

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
pnpm lint              # ESLint — 0 errors, 0 warnings
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

### Issue fields (Priority / Effort)

Issues use GitHub's Task-type custom fields (`Priority`, `Effort`). They are
**not** labels and are **not** in `gh issue list/view --json` output (REST).
Read them via GraphQL `issueFieldValues`:

```bash
gh api graphql -f query='query { repository(owner:"StartlineAU", name:"startline-web-app") { issues(states:OPEN, first:100){ nodes { number title milestone { title } issueFieldValues(first:20){ nodes { ... on IssueFieldSingleSelectValue { value field { ... on IssueFieldSingleSelect { name } } } } } } } } }'
```

`issueFieldValues` is a union of `IssueFieldSingleSelectValue` (has `name`/`value`/
`field`), `IssueFieldTextValue`, `IssueFieldNumberValue`, `IssueFieldDateValue`,
`IssueFieldMultiSelectValue` (all expose `value` + `field`). `field` is another
union exposing `name` (e.g. `Priority`, `Effort`).

**When creating a new issue, set `Priority` + `Effort` immediately** (they don't
default). They're single-select fields; set via `setIssueFieldValue` with the
field's `singleSelectOptionId`. Field/option IDs:

```
Priority:  IFSS_kgDOAnp8Qg   Urgent=IFSSO_kgDOBFZBjQ High=IFSSO_kgDOBFZBjg Medium=IFSSO_kgDOBFZBjw Low=IFSSO_kgDOBFZBkA
Effort:    IFSS_kgDOAnp8RQ   High=IFSSO_kgDOBFZBkQ Medium=IFSSO_kgDOBFZBkg Low=IFSSO_kgDOBFZBkw
```

```bash
gh api graphql -f query='mutation { setIssueFieldValue(input: { issueId: "ISSUE_NODE_ID", issueFields: [ { fieldId: "IFSS_kgDOAnp8Qg", singleSelectOptionId: "IFSSO_kgDOBFZBjg" }, { fieldId: "IFSS_kgDOAnp8RQ", singleSelectOptionId: "IFSSO_kgDOBFZBkg" } ] }) { issue { number } } }'
```

Get `issueId` (node ID) and re-verify all issues via the read query above.

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
| `staging` | `main` | Migrate, no seed |

Neither environment seeds on deploy. `prisma db seed` truncates every table
and resets the shared Cognito seed passwords, so it is gated behind the
`SEED_DATABASE` branch variable (set it to `"true"` in the Amplify console
for a deliberate reseed, then set it back). The seed itself also refuses any
non-local `DATABASE_URL` unless `ALLOW_REMOTE_SEED=true`. A failed migration
now fails the build rather than falling back to `migrate reset --force`,
which used to drop the database.

`SEED_DATABASE` is Terraform-managed and pinned to `"false"`, so a console
flip lasts only until the next `terraform apply` resets it. Do the reseed and
flip it back in the same sitting.

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
