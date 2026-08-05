import type { RegistrationStatus } from "@prisma/client";

/**
 * Single source of truth for which registration statuses occupy a spot — in the
 * event's overall cap and in a start wave's capacity. Every capacity count in the
 * app should filter by this set so the numbers agree everywhere.
 *
 * Today only CONFIRMED (paid = registered) counts. When the refund flow lands,
 * a REFUND_REQUESTED / REFUNDED registration has vacated its spot and must NOT be
 * added here — that is the whole point of pulling them out of wave assignment.
 */
export const CAPACITY_COUNTING_STATUSES: RegistrationStatus[] = ["CONFIRMED"];

export function countsAgainstCapacity(status: RegistrationStatus): boolean {
  return CAPACITY_COUNTING_STATUSES.includes(status);
}
