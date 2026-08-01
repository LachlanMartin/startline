-- Athlete-initiated refund state. A REFUND_REQUESTED registration leaves wave
-- assignment and stops counting against capacity; an admin still processes the
-- Stripe refund and flips it to REFUNDED.
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'REFUND_REQUESTED';
