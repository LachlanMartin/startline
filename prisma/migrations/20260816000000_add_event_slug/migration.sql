-- AlterTable
ALTER TABLE "events" ADD COLUMN     "slug" TEXT;

-- Backfill: derive a slug from the title, mirroring lib/slugs.ts (lowercase,
-- [^a-z0-9]+ -> "-", trimmed dashes, ~80 char truncation). Duplicate bases get
-- a numeric suffix ("-2", "-3", ...) via row_number. Titles that slugify to
-- nothing fall back to "event". Must run before the unique index below.
WITH base_slugs AS (
    SELECT
        id,
        regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g') AS raw
    FROM events
),
truncated AS (
    SELECT
        id,
        CASE
            WHEN rtrim(left(trim(BOTH '-' FROM raw), 80), '-') = '' THEN 'event'
            ELSE rtrim(left(trim(BOTH '-' FROM raw), 80), '-')
        END AS slug
    FROM base_slugs
),
numbered AS (
    SELECT
        id,
        slug,
        row_number() OVER (PARTITION BY slug ORDER BY id) AS rn
    FROM truncated
)
UPDATE events e
SET slug = n.slug || CASE WHEN n.rn = 1 THEN '' ELSE '-' || n.rn::text END
FROM numbered n
WHERE e.id = n.id;

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");
