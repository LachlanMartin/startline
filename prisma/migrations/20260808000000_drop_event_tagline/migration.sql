-- Drop unused event tagline (never exposed in the listing wizard).
ALTER TABLE "events" DROP COLUMN IF EXISTS "tagline";
