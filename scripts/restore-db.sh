#!/usr/bin/env bash
set -euo pipefail

# Restore a pg_dump custom-format artifact into a target database.
#
# Usage: restore-db.sh <source> <target-database-url>
#   <source>           s3://bucket/key or a local .dump file
#   <target-database-url>  Connection string to the target DB (must exist)
#
# Destructive: --clean drops the target schema's objects before restoring.

SOURCE="${1:?usage: restore-db.sh <s3://bucket/key|local.dump> <target-database-url>}"
TARGET_URL="${2:?usage: restore-db.sh <s3://bucket/key|local.dump> <target-database-url>}"

if [[ "$SOURCE" == s3://* ]]; then
  TMP="${TMPDIR:-/tmp}/startline-restore-$$.dump"
  trap 'rm -f "$TMP"' EXIT
  echo "restore: downloading $SOURCE"
  aws s3 cp "$SOURCE" "$TMP" --no-progress
  SOURCE="$TMP"
fi

echo "restore: restoring $(basename "$SOURCE") into ${TARGET_URL%%@*}@..."
pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$TARGET_URL" "$SOURCE"
echo "restore: done"
