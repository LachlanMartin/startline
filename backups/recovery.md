# Database backup & recovery runbook

Nightly `pg_dump` backups of the PostgreSQL databases to S3. Covers both staging and prod RDS.

## What the backup contains

- Full logical dump of the database: schema, data, sequences, and `_prisma_migrations` history — everything Prisma needs to keep migrations consistent.
- One file per run: `s3://startline-<env>-backups/postgres/<env>-YYYYMMDD-HHMMSS.dump`
  (custom format, `pg_dump -Fc`, compressed, `--no-owner --no-privileges`).
- **No** Cognito users, Stripe objects, or uploaded images — those live in their own services. Only the Postgres data is covered.

## How to restore

Prereqs: `pg_restore` (client version >= DB server version), `aws` CLI authenticated.

1. Pick an artifact. List the available backups:

   ```sh
   aws s3 ls s3://startline-prod-backups/postgres/
   ```

2. Restore into a target database (the DB must already exist):

   ```sh
   createdb startline_restore   # or: psql ... -c 'CREATE DATABASE startline_restore;'
   ./scripts/restore-db.sh s3://startline-prod-backups/postgres/prod-20260810-120000.dump \
     postgresql://startline:****@<rds-host>:5432/startline_prod?sslmode=require
   ```

   `restore-db.sh` also accepts a local `.dump` file. Restore is destructive to the
   target (`pg_restore --clean --if-exists`) — point it at a scratch DB unless you
   mean to overwrite.

3. Point the app at the restored DB and verify (below).

## Expected RTO / RPO

- **RPO: 24h max.** One backup per night at 22:00 AEST (`.github/workflows/nightly-backup.yml`).
- **RTO: ~30–60 min.** Dump is full, not incremental — restore time scales with DB size.
  Downtime is the restore + verification, not the upload.
- Retention: 90 days in S3, versioned, SSE-S3-encrypted (lifecycle expires objects after 90 days).

## How to verify a restore

A restore is only proven if the app works against it:

1. **Row parity** — compare table counts between source and restored DB:

   ```sh
   # dump side
   pg_dump --data-only --no-owner --table='*' <source-url> | pg_restore --list - | grep TABLE | wc -l
   ```

2. **Schema sanity** — `pg_restore -l` on the artifact lists every object it restored; the
   restore run itself exits non-zero on any failure (`set -e` in the script).
3. **App smoke test** — start the app with `DATABASE_URL` pointing at the restored DB and:
   - load the events listing page (DB read),
   - run `npx prisma migrate status` — it should report "Database schema is up to date"
     (this validates `_prisma_migrations` integrity).
4. **Restore rehearsal** — run one end-to-end restore to a scratch DB periodically.
   Evidence of the latest rehearsal: `backups/rehearsal-2026-08-11.log`.

## Operations notes

- **Bucket lifecycle:** terraform in `modules/environment/main.tf` creates
  `startline-<env>-backups` (encrypted, versioned, 90-day expiry). Apply happens via
  the normal terraform-apply workflow when this merges to `main`.
- **Credentials:** the nightly job assumes the existing `terraform_ci` GitHub Actions
  role (`vars.AWS_ROLE_ARN`, admin, main/prod only).
  <!-- ponytail: admin role reused for the nightly job — swap for a scoped backups role if least-privilege is ever required. -->
- **Staging RDS auto-stops** at midnight Melbourne; the workflow starts it if stopped
  before dumping. Prod RDS has no such schedule.
- **Backup time choice:** 22:00 AEST, before staging's midnight stop. If the DB is
  unreachable, the job fails red — that failure is the alert.
