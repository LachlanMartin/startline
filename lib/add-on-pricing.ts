/**
 * Pricing for paid add-ons (event merchandise). Pure, no Prisma, no Stripe.
 *
 * This is the single source of truth for add-on money. The athlete's picker,
 * the checkout route and the Stripe webhook all price a basket by calling
 * `priceAddOnSelection` and summing with `sumAddOnLines`, and they must agree to
 * the cent: the webhook compares `paymentIntent.amount_received` against a total
 * it re-derives here, and on a mismatch it writes CANCELLED registrations and
 * keeps the athlete's money. One cent of divergence is a lost race entry.
 *
 * Two rules protect that:
 *
 *  1. The fee is rounded ONCE per line, over `unitPriceCents * quantity`. Never
 *     per unit, never over a running subtotal. 3 x $1.70 is
 *     round(510 * 0.0395) = 20; rounding per unit gives 21.
 *  2. Every caller goes through `priceAddOnSelection`, which normalises its
 *     input first. Normalisation is idempotent, so pricing the client's
 *     selection and pricing the same basket rebuilt from Stripe metadata land on
 *     the same number.
 */

import { calculateAddOnPlatformFee } from "@/lib/platform-fee";
import { MAX_ADDON_LINES, MAX_ADDON_QUANTITY } from "@/lib/add-ons";

/** A variant as the server knows it, read from the DB and never trusted from the client. */
export interface AddOnCatalogueVariant {
  variantId: string;
  addOnId: string;
  /** Stable short code carried in Stripe metadata. */
  code: string;
  /** Product name, e.g. "Event tee". */
  name: string;
  /** Option group heading, e.g. "Size". */
  optionLabel: string;
  /** Option value, e.g. "M". */
  variantLabel: string;
  imageUrl: string | null;
  /** Price of one unit before the Startline fee, in cents. */
  unitPriceCents: number;
}

/** What the athlete asked for. Ids and quantities only, never a price. */
export interface AddOnSelectionLine {
  participantIndex: number;
  variantId: string;
  quantity: number;
}

/** The same line rebuilt from Stripe metadata, which carries codes rather than ids. */
export interface AddOnCodeLine {
  participantIndex: number;
  code: string;
  quantity: number;
}

export interface PricedAddOnLine {
  participantIndex: number;
  variantId: string;
  addOnId: string;
  code: string;
  name: string;
  optionLabel: string;
  variantLabel: string;
  imageUrl: string | null;
  unitPriceCents: number;
  quantity: number;
  /** unitPriceCents * quantity. */
  amountCents: number;
  /** Percentage-only Startline fee, rounded once over amountCents. */
  platformFeeCents: number;
  /** What the athlete's card is charged for this line. */
  chargedCents: number;
}

export interface AddOnTotals {
  /** Sum of the line amounts, before the Startline fee. This is the organiser's money. */
  amountCents: number;
  platformFeeCents: number;
  /** Sum of the line charges. This is what to add to the PaymentIntent. */
  chargedCents: number;
}

export interface PricedAddOnSelection {
  lines: PricedAddOnLine[];
  /**
   * Lines whose variant is not in the catalogue. Never priced, never silently
   * dropped: checkout rejects the order and the webhook treats a non-empty
   * unresolved list as a pricing mismatch, because a line it cannot price is a
   * line the athlete may have been charged for.
   */
  unresolved: AddOnSelectionLine[];
  totals: AddOnTotals;
}

/**
 * Collapse a raw selection into a canonical basket: drop junk, merge duplicate
 * (participantIndex, variantId) pairs, clamp quantities, cap the line count and
 * sort deterministically.
 *
 * Merging is a security control, not tidiness. Without it a client sends the
 * same line ten times and walks past the per-line quantity cap. Clamping after
 * the merge is what closes that.
 *
 * Idempotent by construction: normalising twice gives the same basket as
 * normalising once. That is what lets checkout and the webhook price the same
 * basket independently and still agree.
 */
export function normaliseSelection(
  lines: readonly AddOnSelectionLine[] | null | undefined,
): AddOnSelectionLine[] {
  if (!Array.isArray(lines)) return [];

  const merged = new Map<string, AddOnSelectionLine>();
  for (const line of lines) {
    if (!line) continue;
    const participantIndex = Number(line.participantIndex);
    const quantity = Number(line.quantity);
    const variantId = typeof line.variantId === "string" ? line.variantId : "";
    if (!variantId) continue;
    if (!Number.isInteger(participantIndex) || participantIndex < 0) continue;
    if (!Number.isInteger(quantity) || quantity <= 0) continue;

    const key = `${participantIndex}:${variantId}`;
    const prior = merged.get(key);
    if (prior) {
      prior.quantity += quantity;
    } else {
      merged.set(key, { participantIndex, variantId, quantity });
    }
  }

  return [...merged.values()]
    .map((line) => ({ ...line, quantity: Math.min(line.quantity, MAX_ADDON_QUANTITY) }))
    .sort((a, b) => {
      if (a.participantIndex !== b.participantIndex) return a.participantIndex - b.participantIndex;
      return a.variantId < b.variantId ? -1 : a.variantId > b.variantId ? 1 : 0;
    })
    .slice(0, MAX_ADDON_LINES);
}

/**
 * Rebuild a selection from the codes carried in Stripe metadata. An unknown code
 * survives as a line with a variantId nothing matches, so it lands in
 * unresolved rather than vanishing from the total.
 */
export function selectionFromCodeLines(
  codeLines: readonly AddOnCodeLine[] | null | undefined,
  catalogue: readonly AddOnCatalogueVariant[],
): AddOnSelectionLine[] {
  if (!Array.isArray(codeLines)) return [];
  const byCode = new Map(catalogue.map((variant) => [variant.code, variant]));
  const resolved: AddOnSelectionLine[] = [];
  for (const line of codeLines) {
    if (!line) continue;
    const variant = byCode.get(line.code);
    resolved.push({
      participantIndex: line.participantIndex,
      variantId: variant ? variant.variantId : `unknown:${line.code}`,
      quantity: line.quantity,
    });
  }
  return resolved;
}

/** Price one line. The single place add-on fee rounding happens. */
export function priceAddOnLine(
  unitPriceCents: number,
  quantity: number,
  feeStructure: string,
): { amountCents: number; platformFeeCents: number; chargedCents: number } {
  const amountCents = unitPriceCents * quantity;
  const platformFeeCents = calculateAddOnPlatformFee(amountCents);
  const chargedCents = feeStructure === "athlete" ? amountCents + platformFeeCents : amountCents;
  return { amountCents, platformFeeCents, chargedCents };
}

/**
 * Price a whole basket against the catalogue. Normalises first, so callers must
 * not pre-normalise and must not price lines by hand.
 *
 * The catalogue passed in must NOT be filtered by active: a product retired
 * between the payment and the webhook still has to price the purchase in
 * flight. Filtering is checkout's job, at the point of sale.
 */
export function priceAddOnSelection(
  selection: readonly AddOnSelectionLine[] | null | undefined,
  catalogue: readonly AddOnCatalogueVariant[],
  feeStructure: string,
): PricedAddOnSelection {
  const normalised = normaliseSelection(selection);
  const byId = new Map(catalogue.map((variant) => [variant.variantId, variant]));

  const lines: PricedAddOnLine[] = [];
  const unresolved: AddOnSelectionLine[] = [];

  for (const line of normalised) {
    const variant = byId.get(line.variantId);
    if (!variant) {
      unresolved.push(line);
      continue;
    }
    const priced = priceAddOnLine(variant.unitPriceCents, line.quantity, feeStructure);
    lines.push({
      participantIndex: line.participantIndex,
      variantId: variant.variantId,
      addOnId: variant.addOnId,
      code: variant.code,
      name: variant.name,
      optionLabel: variant.optionLabel,
      variantLabel: variant.variantLabel,
      imageUrl: variant.imageUrl,
      unitPriceCents: variant.unitPriceCents,
      quantity: line.quantity,
      ...priced,
    });
  }

  return { lines, unresolved, totals: sumAddOnLines(lines) };
}

/**
 * Add up priced lines. Summing charges that were each rounded once is what keeps
 * checkout and the webhook aligned; rounding a sum would not.
 */
export function sumAddOnLines(lines: readonly PricedAddOnLine[]): AddOnTotals {
  return lines.reduce<AddOnTotals>(
    (totals, line) => ({
      amountCents: totals.amountCents + line.amountCents,
      platformFeeCents: totals.platformFeeCents + line.platformFeeCents,
      chargedCents: totals.chargedCents + line.chargedCents,
    }),
    { amountCents: 0, platformFeeCents: 0, chargedCents: 0 },
  );
}
