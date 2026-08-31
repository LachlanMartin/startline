-- CreateEnum
CREATE TYPE "AddOnItemStatus" AS ENUM ('PURCHASED', 'REFUND_REQUESTED', 'REFUNDED', 'CANCELLED');

-- CreateTable
CREATE TABLE "event_add_ons" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "optionLabel" TEXT NOT NULL DEFAULT 'Size',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_add_ons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_add_on_variants" (
    "id" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_add_on_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_add_ons" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "optionLabelSnapshot" TEXT NOT NULL,
    "variantLabelSnapshot" TEXT NOT NULL,
    "imageUrlSnapshot" TEXT,
    "unitPriceCents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amountCents" INTEGER NOT NULL,
    "platformFeeCents" INTEGER NOT NULL DEFAULT 0,
    "feeStructure" TEXT NOT NULL DEFAULT 'athlete',
    "status" "AddOnItemStatus" NOT NULL DEFAULT 'PURCHASED',
    "refundRequestedAt" TIMESTAMP(3),
    "refundReason" TEXT,
    "refundAmountCents" INTEGER,
    "refundDecidedAt" TIMESTAMP(3),
    "refundDecidedBy" TEXT,
    "refundDeclinedAt" TIMESTAMP(3),
    "refundDeclineReason" TEXT,
    "stripeRefundId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registration_add_ons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_add_ons_eventId_idx" ON "event_add_ons"("eventId");

-- CreateIndex
CREATE INDEX "event_add_on_variants_eventId_idx" ON "event_add_on_variants"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "event_add_on_variants_addOnId_label_key" ON "event_add_on_variants"("addOnId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "event_add_on_variants_eventId_code_key" ON "event_add_on_variants"("eventId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "registration_add_ons_stripeRefundId_key" ON "registration_add_ons"("stripeRefundId");

-- CreateIndex
CREATE INDEX "registration_add_ons_registrationId_idx" ON "registration_add_ons"("registrationId");

-- CreateIndex
CREATE INDEX "registration_add_ons_eventId_idx" ON "registration_add_ons"("eventId");

-- CreateIndex
CREATE INDEX "registration_add_ons_variantId_status_idx" ON "registration_add_ons"("variantId", "status");

-- AddForeignKey
ALTER TABLE "event_add_ons" ADD CONSTRAINT "event_add_ons_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_add_on_variants" ADD CONSTRAINT "event_add_on_variants_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "event_add_ons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_add_on_variants" ADD CONSTRAINT "event_add_on_variants_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_add_ons" ADD CONSTRAINT "registration_add_ons_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_add_ons" ADD CONSTRAINT "registration_add_ons_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_add_ons" ADD CONSTRAINT "registration_add_ons_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "event_add_ons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_add_ons" ADD CONSTRAINT "registration_add_ons_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "event_add_on_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
