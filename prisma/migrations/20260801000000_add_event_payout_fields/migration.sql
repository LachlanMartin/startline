-- AlterTable
ALTER TABLE "events" ADD COLUMN     "payoutAmountCents" INTEGER,
ADD COLUMN     "payoutAt" TIMESTAMP(3),
ADD COLUMN     "payoutTriggered" BOOLEAN NOT NULL DEFAULT false;
