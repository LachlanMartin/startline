-- Reconstructed placeholder.
--
-- This migration is recorded as applied in existing databases (2026-08-04) but its
-- folder was never committed to git, so Prisma saw the history as corrupt and
-- wanted to reset. Restoring the folder repairs the history without touching data.
--
-- It is intentionally a no-op. The migration dropped some unused Event logistics
-- columns, but bagDrop, parking, accessibilityInfo and additionalNotes are all
-- present again in both the current schema and existing databases, so its effect
-- has been superseded. On a fresh database those columns are simply never dropped,
-- which leaves the same end state the schema asks for.

SELECT 1;
