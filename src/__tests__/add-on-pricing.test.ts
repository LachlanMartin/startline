import { describe, it, expect } from "vitest";
import {
  normaliseSelection,
  selectionFromCodeLines,
  priceAddOnLine,
  priceAddOnSelection,
  sumAddOnLines,
  type AddOnCatalogueVariant,
  type AddOnSelectionLine,
} from "@/lib/add-on-pricing";
import { MAX_ADDON_LINES, MAX_ADDON_QUANTITY } from "@/lib/add-ons";
import { PLATFORM_FEE_FIXED_CENTS } from "@/lib/platform-fee";

function variant(
  overrides: Partial<AddOnCatalogueVariant> & Pick<AddOnCatalogueVariant, "variantId" | "code" | "unitPriceCents">,
): AddOnCatalogueVariant {
  return {
    addOnId: "tee",
    name: "Event tee",
    optionLabel: "Size",
    variantLabel: "M",
    imageUrl: null,
    ...overrides,
  };
}

// Prices chosen to land on awkward rounding boundaries.
const catalogue: AddOnCatalogueVariant[] = [
  variant({ variantId: "v-tee-s", code: "aaa111", unitPriceCents: 2500, variantLabel: "S" }),
  variant({ variantId: "v-tee-m", code: "bbb222", unitPriceCents: 2500, variantLabel: "M" }),
  variant({ variantId: "v-sock", code: "ccc333", unitPriceCents: 170, addOnId: "sock", name: "Socks", variantLabel: "One size" }),
  variant({ variantId: "v-cap", code: "ddd444", unitPriceCents: 333, addOnId: "cap", name: "Cap", variantLabel: "One size" }),
  variant({ variantId: "v-park", code: "eee555", unitPriceCents: 1999, addOnId: "park", name: "Parking pass", variantLabel: "Day" }),
];

describe("calculateAddOnPlatformFee via priceAddOnLine", () => {
  it("charges a percentage only, with no fixed component", () => {
    const { platformFeeCents } = priceAddOnLine(2500, 1, "athlete");
    expect(platformFeeCents).toBe(99); // 3.95% of $25.00
    expect(platformFeeCents).toBeLessThan(PLATFORM_FEE_FIXED_CENTS);
  });

  it("charges nothing on a zero-priced line, unlike a ticket", () => {
    expect(priceAddOnLine(0, 3, "athlete").platformFeeCents).toBe(0);
  });

  it("rounds once over the line total, not per unit", () => {
    // 3 x $1.70. Over the line: round(510 * 0.0395) = 20.
    // Per unit it would be round(170 * 0.0395) = 7, times 3 = 21.
    const { amountCents, platformFeeCents } = priceAddOnLine(170, 3, "athlete");
    expect(amountCents).toBe(510);
    expect(platformFeeCents).toBe(20);
    expect(platformFeeCents).not.toBe(21);
  });

  it("adds the fee to the charge when the athlete pays it", () => {
    const line = priceAddOnLine(2500, 2, "athlete");
    expect(line.amountCents).toBe(5000);
    expect(line.platformFeeCents).toBe(198);
    expect(line.chargedCents).toBe(5198);
  });

  it("leaves the charge at the product price when the organiser pays the fee", () => {
    const line = priceAddOnLine(2500, 2, "organiser");
    expect(line.amountCents).toBe(5000);
    expect(line.platformFeeCents).toBe(198);
    expect(line.chargedCents).toBe(5000);
  });
});

describe("normaliseSelection", () => {
  it("returns an empty basket for null, undefined and non-arrays", () => {
    expect(normaliseSelection(null)).toEqual([]);
    expect(normaliseSelection(undefined)).toEqual([]);
    expect(normaliseSelection([])).toEqual([]);
  });

  it("merges duplicate (participant, variant) pairs into one line", () => {
    const result = normaliseSelection([
      { participantIndex: 0, variantId: "v-tee-m", quantity: 1 },
      { participantIndex: 0, variantId: "v-tee-m", quantity: 2 },
    ]);
    expect(result).toEqual([{ participantIndex: 0, variantId: "v-tee-m", quantity: 3 }]);
  });

  it("keeps the same variant separate for different participants", () => {
    const result = normaliseSelection([
      { participantIndex: 1, variantId: "v-tee-m", quantity: 1 },
      { participantIndex: 0, variantId: "v-tee-m", quantity: 1 },
    ]);
    expect(result).toHaveLength(2);
    expect(result.map((l) => l.participantIndex)).toEqual([0, 1]);
  });

  it("enforces the quantity cap AFTER merging, so repeats cannot walk past it", () => {
    // Ten separate lines of 5 would be 50 units if merging happened after clamping.
    const spam: AddOnSelectionLine[] = Array.from({ length: 10 }, () => ({
      participantIndex: 0,
      variantId: "v-tee-m",
      quantity: 5,
    }));
    const result = normaliseSelection(spam);
    expect(result).toEqual([
      { participantIndex: 0, variantId: "v-tee-m", quantity: MAX_ADDON_QUANTITY },
    ]);
  });

  it("clamps a single over-cap line", () => {
    const result = normaliseSelection([{ participantIndex: 0, variantId: "v-tee-m", quantity: 999 }]);
    expect(result[0].quantity).toBe(MAX_ADDON_QUANTITY);
  });

  it("drops lines with a missing id, or a non-positive or fractional quantity", () => {
    const result = normaliseSelection([
      { participantIndex: 0, variantId: "", quantity: 1 },
      { participantIndex: 0, variantId: "v-tee-m", quantity: 0 },
      { participantIndex: 0, variantId: "v-tee-s", quantity: -3 },
      { participantIndex: 0, variantId: "v-cap", quantity: 1.5 },
      { participantIndex: -1, variantId: "v-sock", quantity: 1 },
    ]);
    expect(result).toEqual([]);
  });

  it("caps the number of distinct lines", () => {
    const many: AddOnSelectionLine[] = Array.from({ length: MAX_ADDON_LINES + 15 }, (_, i) => ({
      participantIndex: i,
      variantId: "v-tee-m",
      quantity: 1,
    }));
    expect(normaliseSelection(many)).toHaveLength(MAX_ADDON_LINES);
  });

  it("is idempotent, which is what lets checkout and the webhook agree", () => {
    const raw: AddOnSelectionLine[] = [
      { participantIndex: 1, variantId: "v-sock", quantity: 4 },
      { participantIndex: 0, variantId: "v-tee-m", quantity: 7 },
      { participantIndex: 0, variantId: "v-tee-m", quantity: 7 },
      { participantIndex: 0, variantId: "v-cap", quantity: 1 },
    ];
    const once = normaliseSelection(raw);
    expect(normaliseSelection(once)).toEqual(once);
  });

  it("orders deterministically regardless of how the client sent the basket", () => {
    const forwards = normaliseSelection([
      { participantIndex: 0, variantId: "v-cap", quantity: 1 },
      { participantIndex: 0, variantId: "v-tee-m", quantity: 1 },
      { participantIndex: 1, variantId: "v-sock", quantity: 1 },
    ]);
    const backwards = normaliseSelection([
      { participantIndex: 1, variantId: "v-sock", quantity: 1 },
      { participantIndex: 0, variantId: "v-tee-m", quantity: 1 },
      { participantIndex: 0, variantId: "v-cap", quantity: 1 },
    ]);
    expect(backwards).toEqual(forwards);
  });
});

describe("priceAddOnSelection", () => {
  it("prices a basket and totals the lines", () => {
    const priced = priceAddOnSelection(
      [
        { participantIndex: 0, variantId: "v-tee-m", quantity: 1 },
        { participantIndex: 0, variantId: "v-sock", quantity: 3 },
      ],
      catalogue,
      "athlete",
    );
    expect(priced.unresolved).toEqual([]);
    expect(priced.totals.amountCents).toBe(2500 + 510);
    expect(priced.totals.platformFeeCents).toBe(99 + 20);
    expect(priced.totals.chargedCents).toBe(2500 + 510 + 99 + 20);
  });

  it("snapshots the catalogue values onto each line", () => {
    const [line] = priceAddOnSelection(
      [{ participantIndex: 2, variantId: "v-park", quantity: 1 }],
      catalogue,
      "athlete",
    ).lines;
    expect(line).toMatchObject({
      participantIndex: 2,
      variantId: "v-park",
      addOnId: "park",
      code: "eee555",
      name: "Parking pass",
      optionLabel: "Size",
      variantLabel: "Day",
      unitPriceCents: 1999,
      quantity: 1,
    });
  });

  it("collects unknown variants as unresolved rather than dropping them", () => {
    const priced = priceAddOnSelection(
      [
        { participantIndex: 0, variantId: "v-tee-m", quantity: 1 },
        { participantIndex: 0, variantId: "v-deleted", quantity: 2 },
      ],
      catalogue,
      "athlete",
    );
    expect(priced.lines).toHaveLength(1);
    expect(priced.unresolved).toEqual([
      { participantIndex: 0, variantId: "v-deleted", quantity: 2 },
    ]);
  });

  it("normalises its own input, so a caller cannot skip the merge", () => {
    const priced = priceAddOnSelection(
      [
        { participantIndex: 0, variantId: "v-tee-m", quantity: 8 },
        { participantIndex: 0, variantId: "v-tee-m", quantity: 8 },
      ],
      catalogue,
      "athlete",
    );
    expect(priced.lines).toHaveLength(1);
    expect(priced.lines[0].quantity).toBe(MAX_ADDON_QUANTITY);
  });

  it("keeps the charge at the product price when the organiser pays the fee", () => {
    const priced = priceAddOnSelection(
      [{ participantIndex: 0, variantId: "v-tee-m", quantity: 2 }],
      catalogue,
      "organiser",
    );
    expect(priced.totals.chargedCents).toBe(5000);
    expect(priced.totals.platformFeeCents).toBe(198);
  });
});

describe("sumAddOnLines", () => {
  it("is zero for an empty basket", () => {
    expect(sumAddOnLines([])).toEqual({ amountCents: 0, platformFeeCents: 0, chargedCents: 0 });
  });
});

// ─── The keystone: checkout and webhook must agree to the cent ───────────────
//
// The webhook compares paymentIntent.amount_received against a total it
// re-derives from the DB. On a mismatch it writes CANCELLED registrations with
// amountCents 0 and returns, keeping the athlete's money with no refund. So a
// single cent of divergence between the two pricing paths is a lost race entry.
//
// Each basket below is run through the exact sequence checkout uses, encoded to
// Stripe metadata the way checkout writes it, then run through the exact
// sequence the webhook uses. The two must produce identical cents.

const baskets: { name: string; lines: AddOnSelectionLine[] }[] = [
  { name: "empty basket", lines: [] },
  { name: "one shirt", lines: [{ participantIndex: 0, variantId: "v-tee-m", quantity: 1 }] },
  { name: "three socks, the per-unit rounding trap", lines: [{ participantIndex: 0, variantId: "v-sock", quantity: 3 }] },
  {
    name: "two participants, same shirt",
    lines: [
      { participantIndex: 0, variantId: "v-tee-m", quantity: 1 },
      { participantIndex: 1, variantId: "v-tee-m", quantity: 1 },
    ],
  },
  {
    name: "duplicate lines that must merge",
    lines: [
      { participantIndex: 0, variantId: "v-cap", quantity: 2 },
      { participantIndex: 0, variantId: "v-cap", quantity: 2 },
    ],
  },
  {
    name: "over-cap quantity that must clamp",
    lines: [{ participantIndex: 0, variantId: "v-park", quantity: 40 }],
  },
  {
    name: "one of everything",
    lines: catalogue.map((v, i) => ({ participantIndex: i, variantId: v.variantId, quantity: 1 })),
  },
  {
    name: "family of four, mixed sizes and quantities",
    lines: [
      { participantIndex: 0, variantId: "v-tee-s", quantity: 1 },
      { participantIndex: 1, variantId: "v-tee-m", quantity: 2 },
      { participantIndex: 2, variantId: "v-sock", quantity: 3 },
      { participantIndex: 3, variantId: "v-cap", quantity: 7 },
      { participantIndex: 0, variantId: "v-park", quantity: 1 },
    ],
  },
  {
    name: "awkward prices at maximum quantity",
    lines: [
      { participantIndex: 0, variantId: "v-cap", quantity: 10 },
      { participantIndex: 0, variantId: "v-sock", quantity: 9 },
      { participantIndex: 1, variantId: "v-park", quantity: 3 },
    ],
  },
  {
    name: "a full basket at the line cap",
    lines: Array.from({ length: MAX_ADDON_LINES }, (_, i) => ({
      participantIndex: i % 10,
      variantId: catalogue[i % catalogue.length].variantId,
      quantity: (i % MAX_ADDON_QUANTITY) + 1,
    })),
  },
];

describe.each(["athlete", "organiser"])("checkout / webhook parity (%s pays the fee)", (feeStructure) => {
  it.each(baskets)("agrees to the cent: $name", ({ lines }) => {
    // What checkout does with the client's selection.
    const checkout = priceAddOnSelection(lines, catalogue, feeStructure);

    // What checkout writes into Stripe metadata: codes, not ids.
    const metadata = checkout.lines.map((line) => ({
      participantIndex: line.participantIndex,
      code: line.code,
      quantity: line.quantity,
    }));

    // What the webhook does, against a catalogue the organiser has since
    // reordered. Codes are stable, so the resolution must not care.
    const reordered = [...catalogue].reverse();
    const webhook = priceAddOnSelection(
      selectionFromCodeLines(metadata, reordered),
      reordered,
      feeStructure,
    );

    expect(webhook.totals).toEqual(checkout.totals);
    expect(webhook.unresolved).toEqual([]);
    expect(webhook.lines).toEqual(checkout.lines);
  });
});

describe("selectionFromCodeLines", () => {
  it("resolves codes to variant ids", () => {
    expect(selectionFromCodeLines([{ participantIndex: 0, code: "bbb222", quantity: 2 }], catalogue))
      .toEqual([{ participantIndex: 0, variantId: "v-tee-m", quantity: 2 }]);
  });

  it("keeps an unknown code as an unpriceable line so it cannot vanish from the total", () => {
    const priced = priceAddOnSelection(
      selectionFromCodeLines([{ participantIndex: 0, code: "zzz999", quantity: 1 }], catalogue),
      catalogue,
      "athlete",
    );
    expect(priced.lines).toEqual([]);
    expect(priced.unresolved).toHaveLength(1);
    expect(priced.totals.chargedCents).toBe(0);
  });

  it("returns an empty selection for missing metadata", () => {
    expect(selectionFromCodeLines(null, catalogue)).toEqual([]);
    expect(selectionFromCodeLines(undefined, catalogue)).toEqual([]);
  });
});
