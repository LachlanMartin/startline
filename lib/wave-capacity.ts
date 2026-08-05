/**
 * Pure capacity helpers for the wave allocation board. No DB, no React — just the
 * maths, so both the server (authoritative counts) and the client (optimistic
 * preview) agree on when a wave is near or over its limit.
 */

export type CapacityState = "normal" | "near" | "over";

/**
 * Where a wave sits against its capacity.
 * - `over`   — more athletes than the cap allows (must be unmissable in the UI).
 * - `near`   — at or above 90% of a finite cap.
 * - `normal` — comfortable, or unlimited (capacity null).
 */
export function capacityState(assigned: number, capacity: number | null | undefined): CapacityState {
  if (capacity == null) return "normal"; // unlimited
  if (assigned > capacity) return "over";
  if (capacity > 0 && assigned / capacity >= 0.9) return "near";
  return "normal";
}

/**
 * Preview the effect of moving `movingCount` athletes into a wave that already
 * holds `destAssignedNow` (both counted with capacity-counting statuses only,
 * and excluding the ones being moved). Over-capacity warns but never blocks.
 */
export function previewMove(input: {
  destCapacity: number | null | undefined;
  destAssignedNow: number;
  movingCount: number;
}): { resulting: number; over: boolean; overBy: number } {
  const resulting = input.destAssignedNow + input.movingCount;
  const cap = input.destCapacity;
  const over = cap != null && resulting > cap;
  return { resulting, over, overBy: over ? resulting - cap! : 0 };
}
