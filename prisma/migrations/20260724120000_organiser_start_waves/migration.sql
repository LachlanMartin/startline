-- AlterTable
ALTER TABLE "events" ADD COLUMN "startWaves" JSONB;

-- AlterTable
ALTER TABLE "registrations" ADD COLUMN "startWaveLabel" TEXT;
