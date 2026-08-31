/**
 * Refund decisions for individual purchased add-ons. Pure, no Prisma, no Stripe.
 *
 * Deliberately unlike entry refunds. An entry runs through the organiser's
 * structured policy tiers, where the percentage owed shrinks as the event
 * approaches, because the organiser has committed costs against that start
 * slot. A t-shirt has no such curve: either it has been handed over or it has
 * not. So an add-on refund is all or nothing, the athlete asks per item, and the
 * organiser approves or declines.
 *
 * This is also why refunding an entry does not touch the merchandise, and why
 * refunding merchandise does not touch the entry.
 */

export type AddOnItemStatusLike = "PURCHASED" | "REFUND_REQUESTED" | "REFUNDED" | "CANCELLED";

export interface AddOnRefundItem {
  status: AddOnItemStatusLike;
  /** Product money on the line. */
  amountCents: number;
  /** Startline fee on the line. */
  platformFeeCents: number;
  /** "athlete" | "organiser" — who paid the fee at checkout. */
  feeStructure: string;
}

/**
 * What the athlete gets back: everything they actually paid for this line.
 *
 * When the athlete paid the booking fee it comes back with the item, because
 * they paid it. When the organiser absorbed it, the athlete never paid it, so it
 * is not theirs to receive. Note that whether STARTLINE keeps its fee is a
 * separate question, settled by REFUND_APPLICATION_FEE in lib/stripe-refunds.ts.
 */
export function addOnRefundAmountCents(item: AddOnRefundItem): number {
  const fee = item.feeStructure === "athlete" ? item.platformFeeCents : 0;
  return Math.max(0, item.amountCents + fee);
}

export type AddOnRefundBlock =
  | { ok: true }
  | { ok: false; reason: string; status: 409 | 404 };

/**
 * Whether an athlete may ask for this item back. Returns the message they
 * should see rather than a boolean, so every caller phrases it the same way.
 */
export function canRequestAddOnRefund(input: {
  item: AddOnRefundItem;
  /** Event date as ISO yyyy-mm-dd. */
  eventDate: string;
  /** Today as ISO yyyy-mm-dd. */
  today: string;
}): AddOnRefundBlock {
  const { item, eventDate, today } = input;

  if (item.status === "REFUND_REQUESTED") {
    return {
      ok: false,
      status: 409,
      reason: "You have already asked for this item to be refunded.",
    };
  }
  if (item.status === "REFUNDED") {
    return { ok: false, status: 409, reason: "This item has already been refunded." };
  }
  if (item.status !== "PURCHASED") {
    return { ok: false, status: 409, reason: "This item cannot be refunded." };
  }
  // Compared on date alone, so a request on race day itself is still allowed.
  if (eventDate < today) {
    return {
      ok: false,
      status: 409,
      reason: "This event has already taken place, so it can no longer be refunded.",
    };
  }
  return { ok: true };
}

/** Whether the organiser may still act on this item. */
export function canDecideAddOnRefund(item: AddOnRefundItem): AddOnRefundBlock {
  if (item.status === "REFUNDED") {
    return { ok: false, status: 409, reason: "This item has already been refunded." };
  }
  if (item.status !== "REFUND_REQUESTED") {
    return { ok: false, status: 409, reason: "There is no open refund request for this item." };
  }
  return { ok: true };
}

/** Copy shown to the athlete. Fixed: no percentages, no policy tiers. */
export const ADDON_REFUND_NOTICE =
  "The organiser will approve or decline this request.";
