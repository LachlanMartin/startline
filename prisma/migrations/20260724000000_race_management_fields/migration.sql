-- AlterTable
ALTER TABLE "registrations" ADD COLUMN     "bibNumber" TEXT,
ADD COLUMN     "resultDistance" TEXT,
ADD COLUMN     "resultTime" TEXT,
ADD COLUMN     "resultPlacement" TEXT,
ADD COLUMN     "isPersonalBest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isTopResult" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "registrations_eventId_bibNumber_key" ON "registrations"("eventId", "bibNumber");
