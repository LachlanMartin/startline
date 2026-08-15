#!/usr/bin/env bash
# ponytail: one shared Postgres container, one database per worktree.
# Migrations are tracked per-database, so worktrees never clobber each other's _prisma_migrations.
set -euo pipefail

BRANCH=$(git branch --show-current)
SLUG=$(echo "$BRANCH" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9' '_' | sed 's/_\+/_/g; s/^_//; s/_$//')
DB="startline_${SLUG:-main}"

# ponytail: find postgres by container name, not compose project (worktree dirnames differ from main).
PG=$(docker ps --format '{{.Names}}' | grep -E 'postgres' | head -1 || true)
if [ -z "$PG" ]; then
  echo "No postgres container running. Start infra on the main checkout:" >&2
  echo "  docker compose up -d" >&2
  exit 1
fi

if ! docker exec "$PG" psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB'" | grep -q 1; then
  docker exec "$PG" createdb -U postgres "$DB"
  echo "created database $DB"
fi

export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/$DB?schema=public"

npx prisma migrate dev

if grep -q '^DATABASE_URL=' .env.local 2>/dev/null; then
  sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|" .env.local
else
  printf '\nDATABASE_URL=%s\n' "$DATABASE_URL" >> .env.local
fi
echo "worktree DB ready: $DB (not seeded — run 'pnpm prisma:seed' unless an empty DB is needed)"
