-- DropIndex
DROP INDEX "organiser_members_organiserId_idx";

-- CreateIndex
CREATE INDEX "organiser_members_userId_idx" ON "organiser_members"("userId");
