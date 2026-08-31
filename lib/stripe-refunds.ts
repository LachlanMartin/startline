/**
 * Refund parameters for Startline's Stripe Connect charges, in one place.
 *
 * Every registration payment is a DESTINATION CHARGE: the customer is charged on
 * the platform account, an application_fee_amount is retained, and the remainder
 * is transferred straight to the organiser's connected account. Two properties
 * of that arrangement have to be respected on every single refund.
 *
 * 1. reverse_transfer: true
 *    Stripe's default is that the connected account KEEPS the funds already
 *    transferred to it, leaving the platform to cover the refund out of its own
 *    balance. Every refund Startline issued before this module was paid for by
 *    Startline rather than by the organiser whose event was refunded. Reversing
 *    the transfer pulls the organiser's share back, proportionally to the amount
 *    refunded.
 *
 * 2. An explicit amount, always.
 *    A refund created without an `amount` returns the ENTIRE charge. One
 *    PaymentIntent covers every participant in a group booking, so an amountless
 *    refund for one athlete in a family of ten refunds all ten entries, and with
 *    add-ons it would sweep up the merchandise too. There is no case in this
 *    codebase where refunding the whole charge is correct, so the amount is a
 *    required argument here rather than an optional one.
 *
 * refund_application_fee stays false: Startline retains its booking fee on a
 * refund, which is what covers the Stripe processing fee Stripe does not return.
 * That is a commercial decision, signed off, not a default left unexamined. It
 * means the organiser bears the booking fee on a sale that was refunded, and the
 * organiser terms need to say so.
 */

import type Stripe from "stripe";

/**
 * Whether to hand the platform fee back to the connected account on a refund.
 * False means Startline keeps it. See the note above before changing this: it
 * moves real money and it applies to entries and add-ons alike.
 */
export const REFUND_APPLICATION_FEE = false;

export interface RefundRequest {
  chargeId: string;
  /** Exact cents to return. Never omit: an amountless refund returns the whole charge. */
  amountCents: number;
  /** Makes a retry of the same logical refund a no-op rather than a second refund. */
  idempotencyKey: string;
}

/**
 * Build the params for a refund on a destination charge. Returns the tuple
 * Stripe's SDK takes so the idempotency key cannot be forgotten at the call site.
 */
export function buildRefundParams(
  request: RefundRequest,
): [Stripe.RefundCreateParams, Stripe.RequestOptions] {
  if (!Number.isInteger(request.amountCents) || request.amountCents <= 0) {
    throw new Error(`Refund amount must be a positive whole number of cents, got ${request.amountCents}.`);
  }
  return [
    {
      charge: request.chargeId,
      amount: request.amountCents,
      reverse_transfer: true,
      refund_application_fee: REFUND_APPLICATION_FEE,
    },
    { idempotencyKey: request.idempotencyKey },
  ];
}

export interface EntryRefundInput {
  /** Ticket price on the registration. */
  amountCents: number;
  /** Startline fee on the registration. */
  platformFeeCents: number;
  /** Amount frozen when the athlete asked, or null for a row predating the policy. */
  refundAmountCents: number | null;
}

/** What this ONE entry paid: ticket plus fee. Never the whole charge. */
export function entryPaidCents(input: EntryRefundInput): number {
  return input.amountCents + input.platformFeeCents;
}

/**
 * True when the frozen snapshot says the policy owes nothing. The caller refuses
 * the request rather than refunding zero, so a goodwill exception stays a
 * deliberate manual act in the Stripe dashboard.
 */
export function isOutsidePolicyRefund(input: EntryRefundInput): boolean {
  return input.refundAmountCents === 0;
}

/**
 * Cents to refund for one entry. Always a positive whole number, never
 * undefined, and never more than this entry paid.
 *
 * A null snapshot means the registration predates the structured policy. It
 * falls back to what this entry paid, NOT to the whole charge, which is the
 * difference between refunding one athlete and refunding their whole family.
 */
export function entryRefundAmountCents(input: EntryRefundInput): number {
  const paid = entryPaidCents(input);
  const snapshot = input.refundAmountCents;
  if (snapshot == null) return Math.max(0, paid);
  return Math.max(0, Math.min(snapshot, paid));
}
