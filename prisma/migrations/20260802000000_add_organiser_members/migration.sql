-- CreateEnum
CREATE TYPE "OrganiserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN');

-- CreateTable
CREATE TABLE "organiser_members" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrganiserRole" NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organiser_members_pkey" PRIMARY KEY ("id")
);

-- Backfill: every existing organiser's creator becomes its SUPER_ADMIN member.
INSERT INTO "organiser_members" ("id", "organiserId", "userId", "role", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "id", "userId", 'SUPER_ADMIN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organisers"
WHERE "userId" IS NOT NULL;

-- Drop the 1:1 unique on organisers.userId. Older Prisma generated a bare
-- unique INDEX; newer versions generate a unique CONSTRAINT — handle both.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organisers_userId_key') THEN
    ALTER TABLE "organisers" DROP CONSTRAINT "organisers_userId_key";
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'organisers_userId_key') THEN
    DROP INDEX "organisers_userId_key";
  END IF;
END $$;

-- userId becomes informational createdBy (nullable, non-unique).
ALTER TABLE "organisers" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "organisers" RENAME COLUMN "userId" TO "createdBy";

-- createdBy is no longer a cascade — deleting a User must not delete the org.
ALTER TABLE "organisers" DROP CONSTRAINT "organisers_userId_fkey";
ALTER TABLE "organisers" ADD CONSTRAINT "organisers_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "organiser_members_organiserId_idx" ON "organiser_members"("organiserId");

-- CreateIndex
CREATE UNIQUE INDEX "organiser_members_organiserId_userId_key" ON "organiser_members"("organiserId", "userId");

-- AddForeignKey
ALTER TABLE "organiser_members" ADD CONSTRAINT "organiser_members_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "organisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organiser_members" ADD CONSTRAINT "organiser_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
