---
type: Reference
title: Infrastructure & CI/CD
description: Terraform-managed AWS infrastructure for Startline — including RDS, Cognito, Amplify hosting, VPC networking, GitHub Actions CI/CD, and secrets management.
tags: [startline, infrastructure, terraform, aws, amplify, ci-cd, deployments]
resource: /terraform/main.tf
---

# Infrastructure & CI/CD

Startline's infrastructure is fully defined in **Terraform** with a unified state, deployed via GitHub Actions. The application is hosted on **AWS Amplify** with per-environment databases and Cognito pools.

## Infrastructure Overview

- **Terraform state**: Unified, single state file. `main` branch is the sole source of truth — only pushes to `main` trigger Terraform apply.
- **Root module** (`/terraform/main.tf`): Amplify app, IAM roles, Route 53 DNS, Cloudflare DNS, ACM certificates
- **Environment module** (`/terraform/modules/environment/`): Per-environment VPC + networking, RDS PostgreSQL, Cognito user pool, Amplify branch
- **Two environments**: `prod` and `staging` (defined in `main.tf` → `local.environments`)

## Terraform Structure

| File | Purpose |
|---|---|
| `main.tf` | Root module — Amplify app, IAM roles, build spec, environment module instances |
| `modules/environment/main.tf` | VPC, subnets, RDS, Cognito, Amplify branch |
| `dns.tf` | Cloudflare DNS records for apex and subdomains |
| `cloudflare-dns.tf` | Additional Cloudflare DNS resources |
| `acm.tf` | ACM certificates |
| `github_oidc.tf` | GitHub OIDC provider and IAM roles for CI/CD |
| `iam-policies.tf` | Custom IAM policies for Amplify, CI/CD |
| `iam-users.tf` | IAM users (if needed) |
| `state.tf` | S3 backend for Terraform state |
| `variables.tf` | Input variables |
| `outputs.tf` | Output values |
| `providers.tf` | Provider configuration |
| `versions.tf` | Terraform and provider version constraints |

## CI/CD Pipelines

### Terraform Workflows

| Workflow | Trigger | Scope |
|---|---|---|
| `terraform-plan.yml` | PR to `main` touching `terraform/**` | Plans both environments + Infracost |
| `terraform-apply.yml` | Push to `main` | Applies both environments |

### Application Workflows

| Workflow | Trigger | Scope |
|---|---|---|
| `ci.yml` | PR to `main` | Gitleaks secret scan, lint, typecheck, build, test, e2e (all blocking) |
| `deploy.yml` | Push to `main` or `prod` | Amplify build + deploy, GitHub Deployments API |

### OpenWiki Workflow

| Workflow | Trigger | Scope |
|---|---|---|
| (external) | Scheduled or manual | Regenerates `openwiki/` docs from this repo and refreshes the wiki. Docs are also hand-maintained in `openwiki/`.

## Environments

| Environment | Branch | Amplify Build Behavior |
|---|---|---|
| `prod` | `prod` | Migrate DB, no seed |
| `staging` | `main` | Migrate DB, no seed |
| PR to `main` | Preview (staging) | Inherits staging resources, auth bypass |
| PR to `prod` | Preview (prod) | Inherits prod resources, auth bypass |

Neither environment seeds on deploy. `prisma db seed` truncates every table
and resets the shared Cognito seed passwords, so it is gated behind the
`SEED_DATABASE` branch variable (set it to `"true"` in the Amplify console
for a deliberate reseed, then set it back). The seed itself also refuses any
non-local `DATABASE_URL` unless `ALLOW_REMOTE_SEED=true`. A failed migration
now fails the build rather than falling back to `migrate reset --force`,
which used to drop the database.

The `ENV` env var is set per Amplify branch (`prod` → `prod`, `main` → `staging`). PR previews inherit the target branch's `ENV` value. The build spec uses `$ENV` to select the correct Secrets Manager secret.

## Secrets Management

All secrets are stored in **AWS Secrets Manager** and never committed to the repository:

| Secret | Contents |
|---|---|
| `startline/ci-bootstrap` | CI/CD bootstrap secrets (Amplify PAT, Cloudflare token, Resend key, DigitalOcean token, Gitleaks license) |
| `startline/prod/app` | Production env vars (Cognito IDs, Stripe live keys, S3 credentials, etc.) |
| `startline/staging/app` | Staging env vars (non-production Cognito, RDS, S3) |

**Loading mechanism**: `.envrc` (gitignored) + direnv fetches the appropriate secret and exports to the shell. In CI, the composite action at `.github/actions/load-env/` assumes an OIDC role, fetches secrets, and exports them.

**Key rotation**: Update the secret in AWS Secrets Manager and trigger an Amplify rebuild — no code or Terraform changes needed.

## Related

- [Architecture](/openwiki/architecture/overview.md) — how the app is hosted and routed
- [Auth System](/openwiki/auth/overview.md) — Cognito user pool configuration
- [Payments](/openwiki/payments/overview.md) — Stripe configuration
