-- Deferrals were never a modelled workflow, only a boolean the organiser form
-- set and three athlete-facing surfaces printed a sentence for. Removed to keep
-- the refund policy a single, simple choice.
ALTER TABLE "events" DROP COLUMN "deferralsAccepted";
