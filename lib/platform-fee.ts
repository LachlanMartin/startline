export const PLATFORM_FEE_PERCENT = 0.0395;
export const PLATFORM_FEE_FIXED_CENTS = 145;

/**
 * Startline's cut of a ticket: a percentage plus a fixed component.
 *
 * A free ticket carries no fee at all. The fixed component is not a
 * subscription — it is a share of a sale — so applying it to a $0 ticket would
 * either charge an athlete A$1.45 to enter a free event (athlete-pays) or hand
 * Stripe an application fee larger than the charge (organiser-pays). Both are
 * wrong, so a zero (or nonsensical negative) price yields a zero fee.
 */
export function calculatePlatformFee(amountCents: number): number {
  if (amountCents <= 0) return 0;
  return Math.round(amountCents * PLATFORM_FEE_PERCENT) + PLATFORM_FEE_FIXED_CENTS;
}

export function calculateTotalWithFee(amountCents: number, feeStructure: string): {
  totalCents: number;
  platformFeeCents: number;
} {
  const fee = calculatePlatformFee(amountCents);
  if (feeStructure === "athlete") {
    return { totalCents: amountCents + fee, platformFeeCents: fee };
  }
  return { totalCents: amountCents, platformFeeCents: fee };
}
