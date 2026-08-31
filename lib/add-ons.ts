/**
 * Shared constants, identifiers and labels for paid add-ons (event
 * merchandise). Pure, no Prisma, no Stripe. Imported by the pricing and stock
 * modules, the checkout and webhook routes, and the organiser and athlete UIs
 * so a limit or a label is defined exactly once.
 */

/** Products one event may offer. Keeps the wizard section and the picker short. */
export const MAX_ADD_ONS = 6;

/** Option values per product, e.g. XS through 3XL. */
export const MAX_ADDON_VARIANTS = 12;

/**
 * Distinct (participant, variant) lines in one order. Chosen against the Stripe
 * metadata budget: 40 lines encode to at most 2 keys, so the worst-case order
 * uses 26 of the 50 available.
 */
export const MAX_ADDON_LINES = 40;

/** Units of one variant a single participant may buy. */
export const MAX_ADDON_QUANTITY = 10;

/** Length of a variant's stable metadata code. */
export const VARIANT_CODE_LENGTH = 6;

const CODE_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * A short, stable identifier for a variant, carried in Stripe metadata so the
 * webhook can resolve a purchased line even if the organiser reorders or
 * retires the catalogue while the payment is in flight. Random rather than
 * sequential: a hard-deleted variant frees its slot, and a sequential scheme
 * would hand that slot to a different product while an old payment still
 * referenced it.
 *
 * `taken` must include every code ever issued for the event, retired variants
 * included. `random` is injectable so tests can pin the output.
 */
export function generateVariantCode(
  taken: Iterable<string> = [],
  random: () => number = Math.random,
): string {
  const used = new Set(taken);
  // Bounded so a pathological RNG cannot spin forever; the space is 36^6, so
  // exhausting these attempts against a catalogue of at most 72 codes is not a
  // real outcome.
  for (let attempt = 0; attempt < 100; attempt++) {
    let code = "";
    for (let i = 0; i < VARIANT_CODE_LENGTH; i++) {
      code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length) % CODE_ALPHABET.length];
    }
    if (!used.has(code)) return code;
  }
  throw new Error("Could not generate a unique add-on variant code.");
}

/** True for a well-formed variant code. Used to reject junk before a DB lookup. */
export function isVariantCode(value: string): boolean {
  return new RegExp(`^[a-z0-9]{${VARIANT_CODE_LENGTH}}$`).test(value);
}

/**
 * How a purchased item reads in a stock message or a picking list:
 * `Event tee - M`. Hyphen, not an em dash.
 */
export function addOnStockLabel(name: string, variantLabel: string): string {
  return variantLabel ? `${name} - ${variantLabel}` : name;
}

/**
 * How a line reads in the athlete's order summary:
 * `Ticket 2 · Event tee (M) × 1`.
 *
 * The ticket number is not decoration. OrderSummary keys its rows on the label,
 * so two participants buying the same shirt would collide on the React key
 * without it.
 */
export function addOnSummaryLabel(input: {
  participantIndex: number;
  name: string;
  variantLabel: string;
  quantity: number;
}): string {
  const product = input.variantLabel ? `${input.name} (${input.variantLabel})` : input.name;
  return `Ticket ${input.participantIndex + 1} · ${product} × ${input.quantity}`;
}

/**
 * Kill switch for selling add-ons. Read by checkout only.
 *
 * Enabled unless ADDONS_ENABLED is explicitly "false", so a deploy does not need
 * a config change to work. Setting it to "false" stops new baskets from being
 * priced or charged while leaving every existing purchase, refund and picking
 * list fully functional, which is what makes it useful as an incident response.
 */
export function addOnsEnabled(): boolean {
  return process.env.ADDONS_ENABLED !== "false";
}

// ─── Organiser input validation ──────────────────────────────────────────────

/** Maximum price for one add-on unit, in cents. */
export const MAX_ADDON_PRICE_CENTS = 1_000_000; // $10,000
/** Maximum stock an organiser can declare for one variant. */
export const MAX_ADDON_STOCK = 1_000_000;

export interface AddOnVariantInput {
  /** Present when editing an existing variant, absent when creating one. */
  id?: string;
  label: string;
  stock: number;
}

export interface AddOnInput {
  id?: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  optionLabel: string;
  variants: AddOnVariantInput[];
}

/**
 * Validate and normalise a raw add-on array from the client. Returns an error
 * object rather than throwing, so the route can answer 400 with the message the
 * organiser should see. Mirrors sanitizeWaveInput in lib/start-waves.ts.
 *
 * Stock is not checked against what has already sold here: that needs the
 * database, so the route does it.
 */
export function sanitizeAddOnInput(input: unknown): AddOnInput[] | { error: string } {
  if (!Array.isArray(input)) return { error: "addOns must be an array." };
  if (input.length > MAX_ADD_ONS) {
    return { error: `An event can offer at most ${MAX_ADD_ONS} add-ons.` };
  }

  const out: AddOnInput[] = [];
  const seenNames = new Set<string>();

  for (const raw of input) {
    if (!raw || typeof raw !== "object") return { error: "Each add-on must be an object." };
    const a = raw as Record<string, unknown>;

    const name = String(a.name ?? "").trim();
    if (!name) return { error: "Every add-on needs a name." };
    if (name.length > 120) return { error: "An add-on name must be 120 characters or fewer." };
    const nameKey = name.toLowerCase();
    if (seenNames.has(nameKey)) return { error: `Duplicate add-on name "${name}".` };
    seenNames.add(nameKey);

    const priceRaw = Number(a.priceCents);
    if (!Number.isInteger(priceRaw) || priceRaw < 0 || priceRaw > MAX_ADDON_PRICE_CENTS) {
      return { error: `"${name}" needs a price between $0 and $${MAX_ADDON_PRICE_CENTS / 100}.` };
    }

    const optionLabel = String(a.optionLabel ?? "").trim() || "Size";
    if (optionLabel.length > 40) return { error: "An option label must be 40 characters or fewer." };

    const description = String(a.description ?? "").trim();
    if (description.length > 2000) return { error: "An add-on description must be 2000 characters or fewer." };

    const imageUrl = String(a.imageUrl ?? "").trim();
    if (imageUrl.length > 2000) return { error: "An add-on image URL is too long." };

    if (!Array.isArray(a.variants) || a.variants.length === 0) {
      return { error: `"${name}" needs at least one ${optionLabel.toLowerCase()} option.` };
    }
    if (a.variants.length > MAX_ADDON_VARIANTS) {
      return { error: `"${name}" can have at most ${MAX_ADDON_VARIANTS} options.` };
    }

    const variants: AddOnVariantInput[] = [];
    const seenLabels = new Set<string>();
    for (const rawVariant of a.variants) {
      if (!rawVariant || typeof rawVariant !== "object") {
        return { error: `Each option on "${name}" must be an object.` };
      }
      const v = rawVariant as Record<string, unknown>;
      const label = String(v.label ?? "").trim();
      if (!label) return { error: `Every option on "${name}" needs a name.` };
      if (label.length > 60) return { error: "An option name must be 60 characters or fewer." };
      const labelKey = label.toLowerCase();
      if (seenLabels.has(labelKey)) {
        return { error: `"${name}" has two options called "${label}".` };
      }
      seenLabels.add(labelKey);

      const stock = Number(v.stock);
      if (!Number.isInteger(stock) || stock < 0 || stock > MAX_ADDON_STOCK) {
        return { error: `"${name} - ${label}" needs a whole number of units, 0 or more.` };
      }

      const id = String(v.id ?? "").trim();
      variants.push({ ...(id ? { id } : {}), label, stock });
    }

    const id = String(a.id ?? "").trim();
    out.push({
      ...(id ? { id } : {}),
      name,
      description: description || null,
      priceCents: priceRaw,
      imageUrl: imageUrl || null,
      optionLabel,
      variants,
    });
  }

  return out;
}
