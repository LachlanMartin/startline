/*
  Warnings:

  - A unique constraint covering the columns `[checkInCode]` on the table `events` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "events" ADD COLUMN     "checkInCode" TEXT;

-- AlterTable
ALTER TABLE "registrations" ADD COLUMN     "checkedInAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "events_checkInCode_key" ON "events"("checkInCode");
