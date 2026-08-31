import { describe, it, expect } from "vitest";
import {
  MAX_ADD_ONS,
  MAX_ADDON_VARIANTS,
  MAX_ADDON_LINES,
  MAX_ADDON_QUANTITY,
  VARIANT_CODE_LENGTH,
  generateVariantCode,
  isVariantCode,
  addOnStockLabel,
  addOnSummaryLabel,
} from "@/lib/add-ons";

/** A deterministic stand-in for Math.random, cycling through fixed draws. */
function seeded(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("generateVariantCode", () => {
  it("produces a code of the expected shape", () => {
    const code = generateVariantCode([], seeded([0]));
    expect(code).toHaveLength(VARIANT_CODE_LENGTH);
    expect(isVariantCode(code)).toBe(true);
  });

  it("never returns a code already issued for the event", () => {
    // First draw would give "aaaaaa", which is taken; the next gives "bbbbbb".
    const random = seeded([0, 0, 0, 0, 0, 0, 1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36]);
    expect(generateVariantCode(["aaaaaa"], random)).toBe("bbbbbb");
  });

  it("generates distinct codes across a full catalogue", () => {
    const codes = new Set<string>();
    for (let i = 0; i < MAX_ADD_ONS * MAX_ADDON_VARIANTS; i++) {
      codes.add(generateVariantCode(codes));
    }
    expect(codes.size).toBe(MAX_ADD_ONS * MAX_ADDON_VARIANTS);
  });

  it("gives up rather than spinning forever against an exhausted alphabet", () => {
    const allOnes = seeded([0]); // always draws "aaaaaa"
    expect(() => generateVariantCode(["aaaaaa"], allOnes)).toThrow(/unique add-on variant code/);
  });
});

describe("isVariantCode", () => {
  it("accepts a well-formed code", () => {
    expect(isVariantCode("ab12cd")).toBe(true);
  });

  it("rejects wrong lengths, uppercase and punctuation", () => {
    expect(isVariantCode("abc")).toBe(false);
    expect(isVariantCode("abc1234")).toBe(false);
    expect(isVariantCode("ABC123")).toBe(false);
    expect(isVariantCode("ab-12c")).toBe(false);
    expect(isVariantCode("")).toBe(false);
  });
});

describe("addOnStockLabel", () => {
  it("joins the product and option with a hyphen, not an em dash", () => {
    const label = addOnStockLabel("Event tee", "M");
    expect(label).toBe("Event tee - M");
    expect(label).not.toContain("—");
  });

  it("uses the product name alone when there is no option", () => {
    expect(addOnStockLabel("Parking pass", "")).toBe("Parking pass");
  });
});

describe("addOnSummaryLabel", () => {
  it("reads as a line in the order summary", () => {
    expect(addOnSummaryLabel({ participantIndex: 1, name: "Event tee", variantLabel: "M", quantity: 1 }))
      .toBe("Ticket 2 · Event tee (M) × 1");
  });

  // OrderSummary keys its rows on the label, so two participants buying the same
  // shirt would collide on the React key without the ticket number.
  it("stays unique when two participants buy the same item", () => {
    const first = addOnSummaryLabel({ participantIndex: 0, name: "Event tee", variantLabel: "M", quantity: 1 });
    const second = addOnSummaryLabel({ participantIndex: 1, name: "Event tee", variantLabel: "M", quantity: 1 });
    expect(first).not.toBe(second);
  });

  it("drops the bracket for a product with no options", () => {
    expect(addOnSummaryLabel({ participantIndex: 0, name: "Parking pass", variantLabel: "", quantity: 2 }))
      .toBe("Ticket 1 · Parking pass × 2");
  });
});

describe("limits", () => {
  it("keeps the line cap within the Stripe metadata budget", () => {
    // Entries encode as "<participantIndex>:<code>:<qty>" joined by commas, and
    // are chunked into 490-character keys. 40 lines must stay under 2 keys so the
    // worst-case order uses 26 of the 50 available.
    const worstEntry = `9:${"a".repeat(VARIANT_CODE_LENGTH)}:${MAX_ADDON_QUANTITY}`;
    const encodedLength = MAX_ADDON_LINES * (worstEntry.length + 1);
    expect(Math.ceil(encodedLength / 490)).toBeLessThanOrEqual(2);
  });

  it("cannot ask for more lines than a full catalogue times a full field", () => {
    expect(MAX_ADDON_LINES).toBeLessThanOrEqual(MAX_ADD_ONS * MAX_ADDON_VARIANTS);
  });
});
