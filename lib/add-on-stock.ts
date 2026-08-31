/**
 * Pure stock decisions for paid add-ons. Given a variant's total stock and what
 * is currently held against it, decide whether a basket can proceed, and if not,
 * the message to show the buyer.
 *
 * Stock is DERIVED, never a decrementing counter:
 *
 *   remaining = variant.stock - SUM(quantity) over registration_add_ons
 *               where variantId = ? and status in ('PURCHASED','REFUND_REQUESTED')
 *
 * A counter would drift on every refund and every race. Deriving it gives two
 * correct behaviours for free: refunding an ENTRY leaves its items PURCHASED, so
 * the shirt stays sold and stock stays consumed; approving an ADD-ON refund
 * flips the item to REFUNDED and the stock restores itself.
 *
 * Shaped after lib/registration-capacity.ts, and used in the same three places
 * its ticket counterpart is: advisory on the availability endpoint, an early
 * rejection in checkout before a card is touched, and authoritatively inside the
 * webhook's existing transaction.
 */

import { addOnStockLabel } from "@/lib/add-ons";

/**
 * Item statuses that consume a unit. REFUND_REQUESTED still holds: the shirt is
 * not resellable until the organiser actually approves the refund.
 */
export const STOCK_HOLDING_STATUSES = ["PURCHASED", "REFUND_REQUESTED"] as const;

export type StockHoldingStatus = (typeof STOCK_HOLDING_STATUSES)[number];

/** True for a status that consumes a unit of stock. */
export function holdsStock(status: string): boolean {
  return (STOCK_HOLDING_STATUSES as readonly string[]).includes(status);
}

export interface VariantStock {
  /** Total units ever made available, not a remaining counter. */
  stock: number;
  /** Sum of quantity across rows in a stock-holding status. */
  held: number;
}

/** Units still available. Never negative, even if an oversell slipped through. */
export function remainingStock(input: VariantStock): number {
  return Math.max(0, input.stock - input.held);
}

export interface AddOnStockRequest extends VariantStock {
  variantId: string;
  /** Product name, e.g. "Event tee". */
  name: string;
  /** Option value, e.g. "M". */
  variantLabel: string;
  /** Units this basket wants across every participant. */
  requested: number;
}

/**
 * The first stock problem in the basket, or null when it all fits. Message voice
 * matches getCapacityError: plain hyphens, no em dashes.
 */
export function getStockError(requests: readonly AddOnStockRequest[]): string | null {
  for (const request of requests) {
    if (request.requested <= 0) continue;
    const remaining = remainingStock(request);
    if (request.requested <= remaining) continue;

    const label = addOnStockLabel(request.name, request.variantLabel);
    return remaining === 0
      ? `"${label}" is sold out.`
      : `Only ${remaining} "${label}" left.`;
  }
  return null;
}

/**
 * Roll a basket's per-participant lines up to one entry per variant, which is
 * the granularity stock is counted at.
 */
export function requestedByVariant(
  lines: readonly { variantId: string; quantity: number }[],
): Record<string, number> {
  return lines.reduce<Record<string, number>>((acc, line) => {
    acc[line.variantId] = (acc[line.variantId] ?? 0) + line.quantity;
    return acc;
  }, {});
}

export interface StockPartition<T> {
  /** Lines that fit and should be inserted. */
  fitting: T[];
  /** Lines that no longer fit and must be refunded rather than confirmed. */
  dropped: T[];
}

/**
 * Split a basket into what still fits and what does not, at confirmation time.
 *
 * This is the answer to the last-size-M race, where two athletes both pay for
 * the final unit. For tickets the loser gets CANCELLED registrations, which is
 * documented and tolerated. That outcome is NOT acceptable for merchandise: it
 * would void someone's race entry over a t-shirt, with the entry money already
 * captured.
 *
 * So the rule is that the add-on stock check can never cancel an order. It drops
 * lines. The caller inserts the fitting ones, refunds the dropped cents against
 * the same PaymentIntent, and notifies both parties.
 *
 * Whole lines are dropped, never part of one: a family that ordered three shirts
 * gets three or none of that line, not a partial fill nobody asked for. Lines are
 * considered in the order given, so pass them in the order the athlete built the
 * basket and the earliest choice wins.
 */
export function partitionByStock<T extends { variantId: string; quantity: number }>(
  lines: readonly T[],
  available: Readonly<Record<string, VariantStock>>,
): StockPartition<T> {
  const fitting: T[] = [];
  const dropped: T[] = [];
  const consumed: Record<string, number> = {};

  for (const line of lines) {
    const variant = available[line.variantId];
    if (!variant) {
      dropped.push(line);
      continue;
    }
    const alreadyTaken = consumed[line.variantId] ?? 0;
    const remaining = remainingStock(variant) - alreadyTaken;
    if (line.quantity <= remaining) {
      consumed[line.variantId] = alreadyTaken + line.quantity;
      fitting.push(line);
    } else {
      dropped.push(line);
    }
  }

  return { fitting, dropped };
}
