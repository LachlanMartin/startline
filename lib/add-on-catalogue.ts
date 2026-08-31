/**
 * Database reads for the add-on catalogue, shared by the organiser editor, the
 * athlete's availability endpoint, checkout and the Stripe webhook.
 *
 * The pure decisions live in lib/add-on-pricing.ts and lib/add-on-stock.ts. This
 * module only fetches and shapes; keeping the split means the money logic stays
 * testable without a database.
 */

import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { STOCK_HOLDING_STATUSES, remainingStock } from "@/lib/add-on-stock";
import type { AddOnCatalogueVariant } from "@/lib/add-on-pricing";

/** Accepts either the client or a transaction, so callers can stay inside one. */
type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Every variant on an event, priced, INCLUDING retired ones.
 *
 * Deliberately not filtered by `active`. A product the organiser retires between
 * the athlete paying and the webhook arriving must still price the purchase in
 * flight, or the webhook fails its total check and cancels a paid order.
 * Filtering to what is buyable is the point-of-sale's job, not this function's.
 */
export async function catalogueVariantsForEvent(
  eventId: string,
  db: Db = prisma,
): Promise<AddOnCatalogueVariant[]> {
  const variants = await db.eventAddOnVariant.findMany({
    where: { eventId },
    select: {
      id: true,
      addOnId: true,
      code: true,
      label: true,
      addOn: { select: { name: true, optionLabel: true, priceCents: true, imageUrl: true } },
    },
  });

  return variants.map((variant) => ({
    variantId: variant.id,
    addOnId: variant.addOnId,
    code: variant.code,
    name: variant.addOn.name,
    optionLabel: variant.addOn.optionLabel,
    variantLabel: variant.label,
    imageUrl: variant.addOn.imageUrl,
    unitPriceCents: variant.addOn.priceCents,
  }));
}

/**
 * Units currently held per variant: purchased, plus requested-but-not-yet-decided.
 * This is the subtrahend in the derived stock calculation.
 */
export async function heldByVariant(
  eventId: string,
  db: Db = prisma,
): Promise<Record<string, number>> {
  const grouped = await db.registrationAddOn.groupBy({
    by: ["variantId"],
    where: { eventId, status: { in: [...STOCK_HOLDING_STATUSES] } },
    _sum: { quantity: true },
  });
  return Object.fromEntries(grouped.map((row) => [row.variantId, row._sum.quantity ?? 0]));
}

/** Declared total stock per variant, for the derived remaining calculation. */
export async function stockByVariant(
  eventId: string,
  db: Db = prisma,
): Promise<Record<string, number>> {
  const variants = await db.eventAddOnVariant.findMany({
    where: { eventId },
    select: { id: true, stock: true },
  });
  return Object.fromEntries(variants.map((v) => [v.id, v.stock]));
}

/**
 * Rows referencing each variant in ANY status, retired and refunded included.
 *
 * Governs whether a variant may be hard-deleted. Distinct from `heldByVariant`
 * on purpose: a refunded item frees its stock but its purchase history must
 * still survive, so it blocks deletion while no longer blocking a sale.
 */
export async function purchaseCountByVariant(
  eventId: string,
  db: Db = prisma,
): Promise<Record<string, number>> {
  const grouped = await db.registrationAddOn.groupBy({
    by: ["variantId"],
    where: { eventId },
    _count: { _all: true },
  });
  return Object.fromEntries(grouped.map((row) => [row.variantId, row._count._all]));
}

export interface CatalogueVariantView {
  id: string;
  label: string;
  code: string;
  /** Total units made available. */
  stock: number;
  /** Units held by live purchases. */
  sold: number;
  /** Rows in any status; non-zero means the variant can only be retired, not deleted. */
  purchased: number;
  remaining: number;
  sortOrder: number;
  active: boolean;
}

export interface CatalogueAddOnView {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  optionLabel: string;
  sortOrder: number;
  active: boolean;
  variants: CatalogueVariantView[];
}

/**
 * The catalogue as both portals render it, with derived stock attached.
 * `activeOnly` is what the athlete's picker asks for.
 */
export async function catalogueForEvent(
  eventId: string,
  opts: { activeOnly?: boolean } = {},
  db: Db = prisma,
): Promise<CatalogueAddOnView[]> {
  const [addOns, held, purchased] = await Promise.all([
    db.eventAddOn.findMany({
      where: { eventId, ...(opts.activeOnly ? { active: true } : {}) },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        variants: {
          where: opts.activeOnly ? { active: true } : undefined,
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    }),
    heldByVariant(eventId, db),
    purchaseCountByVariant(eventId, db),
  ]);

  return addOns.map((addOn) => ({
    id: addOn.id,
    name: addOn.name,
    description: addOn.description,
    priceCents: addOn.priceCents,
    imageUrl: addOn.imageUrl,
    optionLabel: addOn.optionLabel,
    sortOrder: addOn.sortOrder,
    active: addOn.active,
    variants: addOn.variants.map((variant) => {
      const sold = held[variant.id] ?? 0;
      return {
        id: variant.id,
        label: variant.label,
        code: variant.code,
        stock: variant.stock,
        sold,
        purchased: purchased[variant.id] ?? 0,
        remaining: remainingStock({ stock: variant.stock, held: sold }),
        sortOrder: variant.sortOrder,
        active: variant.active,
      };
    }),
  }));
}

/** True when the event has anything an athlete could actually buy. */
export function hasBuyableAddOns(catalogue: CatalogueAddOnView[]): boolean {
  return catalogue.some(
    (addOn) => addOn.active && addOn.variants.some((v) => v.active && v.remaining > 0),
  );
}
