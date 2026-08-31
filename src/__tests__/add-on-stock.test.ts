import { describe, it, expect } from "vitest";
import {
  STOCK_HOLDING_STATUSES,
  holdsStock,
  remainingStock,
  getStockError,
  requestedByVariant,
  partitionByStock,
  type AddOnStockRequest,
} from "@/lib/add-on-stock";

const base: AddOnStockRequest = {
  variantId: "v-tee-m",
  name: "Event tee",
  variantLabel: "M",
  stock: 10,
  held: 0,
  requested: 1,
};

describe("holdsStock", () => {
  it("counts purchased and refund-requested items against stock", () => {
    expect(STOCK_HOLDING_STATUSES).toEqual(["PURCHASED", "REFUND_REQUESTED"]);
    expect(holdsStock("PURCHASED")).toBe(true);
    // Still held: the shirt is not resellable until the organiser approves.
    expect(holdsStock("REFUND_REQUESTED")).toBe(true);
  });

  it("frees stock once a refund is approved", () => {
    expect(holdsStock("REFUNDED")).toBe(false);
  });

  it("frees stock for a line that was never honoured", () => {
    expect(holdsStock("CANCELLED")).toBe(false);
  });
});

describe("remainingStock", () => {
  it("is the total made available less what is held", () => {
    expect(remainingStock({ stock: 10, held: 4 })).toBe(6);
  });

  it("is zero, never negative, if an oversell slipped through", () => {
    expect(remainingStock({ stock: 10, held: 14 })).toBe(0);
  });

  it("restores itself when a refund releases a held unit", () => {
    // Three sold, one refunded and so no longer held.
    expect(remainingStock({ stock: 10, held: 2 })).toBe(8);
  });
});

describe("getStockError", () => {
  it("allows a basket that fits", () => {
    expect(getStockError([{ ...base, stock: 10, held: 3, requested: 7 }])).toBeNull();
  });

  it("allows a basket that lands exactly on the limit", () => {
    expect(getStockError([{ ...base, stock: 10, held: 8, requested: 2 }])).toBeNull();
  });

  it("rejects a basket one over the limit", () => {
    expect(getStockError([{ ...base, stock: 10, held: 8, requested: 3 }]))
      .toBe('Only 2 "Event tee - M" left.');
  });

  it("uses a hyphen, not an em dash, in the product label", () => {
    const msg = getStockError([{ ...base, stock: 10, held: 8, requested: 3 }]);
    expect(msg).not.toContain("—");
    expect(msg).toContain("Event tee - M");
  });

  it("reports sold out when nothing is left", () => {
    expect(getStockError([{ ...base, stock: 4, held: 4, requested: 1 }]))
      .toBe('"Event tee - M" is sold out.');
  });

  it("reports sold out for a variant that was never stocked", () => {
    expect(getStockError([{ ...base, stock: 0, held: 0, requested: 1 }]))
      .toBe('"Event tee - M" is sold out.');
  });

  it("reads naturally when exactly one is left", () => {
    expect(getStockError([{ ...base, stock: 10, held: 9, requested: 2 }]))
      .toBe('Only 1 "Event tee - M" left.');
  });

  it("drops the variant label for a product with no options", () => {
    expect(getStockError([{ ...base, name: "Parking pass", variantLabel: "", stock: 1, held: 1, requested: 1 }]))
      .toBe('"Parking pass" is sold out.');
  });

  it("ignores lines asking for nothing", () => {
    expect(getStockError([{ ...base, stock: 0, held: 0, requested: 0 }])).toBeNull();
  });

  it("returns the first problem in the basket", () => {
    const msg = getStockError([
      { ...base, requested: 1 },
      { ...base, variantId: "v-cap", name: "Cap", variantLabel: "One size", stock: 2, held: 2, requested: 1 },
      { ...base, variantId: "v-sock", name: "Socks", variantLabel: "One size", stock: 0, held: 0, requested: 1 },
    ]);
    expect(msg).toBe('"Cap - One size" is sold out.');
  });

  it("allows an empty basket", () => {
    expect(getStockError([])).toBeNull();
  });
});

describe("requestedByVariant", () => {
  it("rolls per-participant lines up to the level stock is counted at", () => {
    expect(
      requestedByVariant([
        { variantId: "v-tee-m", quantity: 1 },
        { variantId: "v-tee-m", quantity: 2 },
        { variantId: "v-cap", quantity: 1 },
      ]),
    ).toEqual({ "v-tee-m": 3, "v-cap": 1 });
  });

  it("is empty for an empty basket", () => {
    expect(requestedByVariant([])).toEqual({});
  });
});

// The last-size-M race: two athletes both pay for the final unit. For tickets
// the loser gets CANCELLED registrations. That is not acceptable for merch, so
// the add-on stock check drops lines instead of ever cancelling an order.
describe("partitionByStock", () => {
  const available = {
    "v-tee-m": { stock: 3, held: 2 }, // one left
    "v-cap": { stock: 10, held: 0 },
  };

  it("keeps everything that fits", () => {
    const { fitting, dropped } = partitionByStock(
      [{ variantId: "v-tee-m", quantity: 1 }, { variantId: "v-cap", quantity: 4 }],
      available,
    );
    expect(fitting).toHaveLength(2);
    expect(dropped).toEqual([]);
  });

  it("drops the line that no longer fits and keeps the rest of the order", () => {
    const { fitting, dropped } = partitionByStock(
      [{ variantId: "v-tee-m", quantity: 2 }, { variantId: "v-cap", quantity: 1 }],
      available,
    );
    expect(dropped).toEqual([{ variantId: "v-tee-m", quantity: 2 }]);
    expect(fitting).toEqual([{ variantId: "v-cap", quantity: 1 }]);
  });

  it("drops a whole line rather than partially filling it", () => {
    const { fitting, dropped } = partitionByStock([{ variantId: "v-tee-m", quantity: 3 }], available);
    expect(fitting).toEqual([]);
    expect(dropped).toEqual([{ variantId: "v-tee-m", quantity: 3 }]);
  });

  it("counts what earlier lines in the same order already took", () => {
    // Two participants each want the last M. First wins, second is dropped.
    const { fitting, dropped } = partitionByStock(
      [
        { variantId: "v-tee-m", quantity: 1, participantIndex: 0 },
        { variantId: "v-tee-m", quantity: 1, participantIndex: 1 },
      ],
      available,
    );
    expect(fitting).toEqual([{ variantId: "v-tee-m", quantity: 1, participantIndex: 0 }]);
    expect(dropped).toEqual([{ variantId: "v-tee-m", quantity: 1, participantIndex: 1 }]);
  });

  it("drops a line whose variant has vanished from the catalogue", () => {
    const { fitting, dropped } = partitionByStock([{ variantId: "v-gone", quantity: 1 }], available);
    expect(fitting).toEqual([]);
    expect(dropped).toHaveLength(1);
  });

  it("never drops anything when the whole basket fits, so a normal order is untouched", () => {
    const { fitting, dropped } = partitionByStock(
      [{ variantId: "v-cap", quantity: 10 }],
      { "v-cap": { stock: 10, held: 0 } },
    );
    expect(fitting).toHaveLength(1);
    expect(dropped).toEqual([]);
  });

  it("handles an empty basket", () => {
    expect(partitionByStock([], available)).toEqual({ fitting: [], dropped: [] });
  });
});
