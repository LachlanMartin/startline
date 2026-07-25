-- CreateTable
CREATE TABLE "organiser_follows" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organiser_follows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organiser_follows_organiserId_idx" ON "organiser_follows"("organiserId");

-- CreateIndex
CREATE UNIQUE INDEX "organiser_follows_userId_organiserId_key" ON "organiser_follows"("userId", "organiserId");

-- AddForeignKey
ALTER TABLE "organiser_follows" ADD CONSTRAINT "organiser_follows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organiser_follows" ADD CONSTRAINT "organiser_follows_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "organisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
