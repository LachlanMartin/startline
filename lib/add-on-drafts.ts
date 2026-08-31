/**
 * The organiser's in-progress add-on catalogue: the shape the editor binds to,
 * and the conversions between it and the API.
 *
 * Pure, so the money conversion and the validation the organiser sees can be
 * tested without a browser. Prices live as dollar strings while being typed (an
 * input cannot hold a half-typed integer sensibly) and become whole cents only
 * at the boundary.
 */

import {
  MAX_ADD_ONS,
  MAX_ADDON_VARIANTS,
  MAX_ADDON_PRICE_CENTS,
  addOnStockLabel,
} from "@/lib/add-ons";
import type { CatalogueAddOnView } from "@/lib/add-on-catalogue";

export interface AddOnVariantDraft {
  /** Present once saved. Absent means "create me". */
  id?: string;
  label: string;
  /** Total units made available, as typed. */
  stock: string;
  /** Units held by live purchases. Read-only, from the server. */
  sold: number;
  /** Rows in any status. Non-zero means this can only be retired, not deleted. */
  purchased: number;
}

export interface AddOnDraft {
  id?: string;
  name: string;
  description: string;
  /** Dollars, as typed, e.g. "25" or "25.00". */
  price: string;
  /** Chosen but not yet uploaded. */
  image: File | null;
  /** Uploaded, or loaded from the server. */
  imageUrl: string;
  optionLabel: string;
  variants: AddOnVariantDraft[];
}

export function emptyVariantDraft(label = ""): AddOnVariantDraft {
  return { label, stock: "", sold: 0, purchased: 0 };
}

export function emptyAddOnDraft(): AddOnDraft {
  return {
    name: "",
    description: "",
    price: "",
    image: null,
    imageUrl: "",
    optionLabel: "Size",
    // Most merchandise is sized, so start where the organiser probably is.
    variants: [emptyVariantDraft("S"), emptyVariantDraft("M"), emptyVariantDraft("L")],
  };
}

/** Server catalogue → editable drafts. */
export function draftsFromCatalogue(catalogue: CatalogueAddOnView[]): AddOnDraft[] {
  return catalogue.map((addOn) => ({
    id: addOn.id,
    name: addOn.name,
    description: addOn.description ?? "",
    price: (addOn.priceCents / 100).toFixed(2),
    image: null,
    imageUrl: addOn.imageUrl ?? "",
    optionLabel: addOn.optionLabel,
    variants: addOn.variants.map((variant) => ({
      id: variant.id,
      label: variant.label,
      stock: String(variant.stock),
      sold: variant.sold,
      purchased: variant.purchased,
    })),
  }));
}

/** Dollars as typed → whole cents. Returns null for anything not a real amount. */
export function parsePriceToCents(price: string): number | null {
  const trimmed = price.trim().replace(/^\$/, "");
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const cents = Math.round(parseFloat(trimmed) * 100);
  return Number.isFinite(cents) ? cents : null;
}

/** Stock as typed → whole units. Returns null for anything not a count. */
export function parseStock(stock: string): number | null {
  const trimmed = stock.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const units = parseInt(trimmed, 10);
  return Number.isFinite(units) ? units : null;
}

/** Units currently held across a product, which is the floor for its stock. */
export function soldForVariant(variant: AddOnVariantDraft): number {
  return variant.sold;
}

/** True once anything has ever been bought, so the row must be retired, not deleted. */
export function hasPurchaseHistory(draft: AddOnDraft): boolean {
  return draft.variants.some((v) => v.purchased > 0);
}

/**
 * The first problem an organiser needs to fix, phrased the way they should see
 * it, or null when the catalogue is ready to save. Mirrors the server's
 * sanitizeAddOnInput so the editor can block a save that would 400 anyway.
 */
export function draftValidationError(drafts: AddOnDraft[]): string | null {
  if (drafts.length > MAX_ADD_ONS) {
    return `An event can offer at most ${MAX_ADD_ONS} add-ons.`;
  }

  const seenNames = new Set<string>();
  for (const draft of drafts) {
    const name = draft.name.trim();
    if (!name) return "Every add-on needs a name.";
    if (name.length > 120) return "An add-on name must be 120 characters or fewer.";
    if (seenNames.has(name.toLowerCase())) return `Duplicate add-on name "${name}".`;
    seenNames.add(name.toLowerCase());

    const cents = parsePriceToCents(draft.price);
    if (cents == null) return `"${name}" needs a price, like 25.00.`;
    if (cents > MAX_ADDON_PRICE_CENTS) {
      return `"${name}" cannot cost more than $${MAX_ADDON_PRICE_CENTS / 100}.`;
    }

    if (!draft.optionLabel.trim()) return `"${name}" needs a name for its option group.`;

    if (draft.variants.length === 0) {
      return `"${name}" needs at least one ${draft.optionLabel.trim().toLowerCase()} option.`;
    }
    if (draft.variants.length > MAX_ADDON_VARIANTS) {
      return `"${name}" can have at most ${MAX_ADDON_VARIANTS} options.`;
    }

    const seenLabels = new Set<string>();
    for (const variant of draft.variants) {
      const label = variant.label.trim();
      if (!label) return `Every option on "${name}" needs a name.`;
      if (label.length > 60) return "An option name must be 60 characters or fewer.";
      if (seenLabels.has(label.toLowerCase())) {
        return `"${name}" has two options called "${label}".`;
      }
      seenLabels.add(label.toLowerCase());

      const stock = parseStock(variant.stock);
      if (stock == null) {
        return `"${addOnStockLabel(name, label)}" needs a number of units, 0 or more.`;
      }
      if (stock < variant.sold) {
        return (
          `"${addOnStockLabel(name, label)}" has already sold ${variant.sold}. ` +
          `Set its stock to ${variant.sold} or more.`
        );
      }
    }
  }

  return null;
}

export interface AddOnPayloadItem {
  id?: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  optionLabel: string;
  variants: { id?: string; label: string; stock: number }[];
}

/**
 * Drafts → the API body. Call only after draftValidationError returns null;
 * anything unparseable here becomes 0 rather than throwing, and the server
 * validates again regardless.
 */
export function draftsToPayload(drafts: AddOnDraft[]): AddOnPayloadItem[] {
  return drafts.map((draft) => ({
    ...(draft.id ? { id: draft.id } : {}),
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    priceCents: parsePriceToCents(draft.price) ?? 0,
    imageUrl: draft.imageUrl.trim() || null,
    optionLabel: draft.optionLabel.trim() || "Size",
    variants: draft.variants.map((variant) => ({
      ...(variant.id ? { id: variant.id } : {}),
      label: variant.label.trim(),
      stock: parseStock(variant.stock) ?? 0,
    })),
  }));
}
