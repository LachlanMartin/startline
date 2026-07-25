-- AlterTable
ALTER TABLE "reviews" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "reviews_organiserId_idx" ON "reviews"("organiserId");

-- CreateIndex
CREATE INDEX "reviews_userId_idx" ON "reviews"("userId");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
