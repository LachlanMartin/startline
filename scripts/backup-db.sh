#!/usr/bin/env bash
set -euo pipefail

# Nightly pg_dump (custom format) of DATABASE_URL, uploaded to S3.
#
# Env:
#   DATABASE_URL      Connection string to dump (required)
#   BACKUP_ENV        Label in the artifact name: staging/prod/local (default: local)
#   BACKUP_S3_BUCKET  Bucket to upload to. Unset = keep the dump locally (dev/rehearsal)
#   BACKUP_S3_PREFIX  S3 key prefix (default: postgres)
#
# Writes: s3://$BACKUP_S3_BUCKET/$BACKUP_S3_PREFIX/$BACKUP_ENV-YYYYMMDD-HHMMSS.dump
#         (or ./$BACKUP_ENV-YYYYMMDD-HHMMSS.dump when bucket unset)

BACKUP_ENV="${BACKUP_ENV:-local}"
BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-postgres}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
FILE="${TMPDIR:-/tmp}/startline-${BACKUP_ENV}-${STAMP}-$$.dump"
trap 'rm -f "$FILE"' EXIT

pg_dump --format=custom --no-owner --no-privileges --file="$FILE" --dbname "$DATABASE_URL"
echo "backup: dumped ${DATABASE_URL%%@*}@... -> $(basename "$FILE") ($(du -h "$FILE" | cut -f1))"

if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
  KEY="${BACKUP_S3_PREFIX}/${BACKUP_ENV}-${STAMP}.dump"
  aws s3 cp "$FILE" "s3://${BACKUP_S3_BUCKET}/${KEY}" --no-progress
  echo "backup: uploaded s3://${BACKUP_S3_BUCKET}/${KEY}"
else
  # ponytail: local-only mode for dev/rehearsal. Delete the artifact when done.
  mv "$FILE" "./${BACKUP_ENV}-${STAMP}.dump"
  echo "backup: kept locally as ./${BACKUP_ENV}-${STAMP}.dump (BACKUP_S3_BUCKET unset)"
fi
