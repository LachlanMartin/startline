-- AlterEnum
ALTER TYPE "UserNotificationType" ADD VALUE 'REFUND_PROCESSED';

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "deferralsAccepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "refundTiers" JSONB;

-- AlterTable
ALTER TABLE "registrations" ADD COLUMN     "refundAmountCents" INTEGER,
ADD COLUMN     "refundOutsidePolicy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "refundPercent" INTEGER,
ADD COLUMN     "refundRequestedAt" TIMESTAMP(3);
