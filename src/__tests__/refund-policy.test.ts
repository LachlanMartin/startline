import { describe, it, expect } from "vitest";
import {
  DEFAULT_REFUND_TIERS,
  REFUND_PRESETS,
  daysUntil,
  describeTiers,
  matchRefundPreset,
  parseLegacyPolicy,
  parseTiers,
  refundAmountCents,
  refundPercentFor,
  tiersAreValid,
  type RefundTier,
} from "@/lib/refund-policy";

const TIERS: RefundTier[] = [
  { daysBefore: 30, percent: 100 },
  { daysBefore: 14, percent: 50 },
];

describe("refundPercentFor", () => {
  it.each([
    [45, 100],
    [31, 100],
    [30, 100], // boundary: exactly 30 days out still gets the full refund
    [29, 50],
    [15, 50],
    [14, 50], // boundary: exactly 14 days out still gets half
    [13, 0],
    [1, 0],
    [0, 0], // race day
  ])("gives %i days out %i percent", (days, expected) => {
    expect(refundPercentFor(TIERS, days)).toBe(expected);
  });

  it("returns nothing for an empty policy", () => {
    expect(refundPercentFor([], 365)).toBe(0);
  });

  it("returns nothing once the event has passed", () => {
    expect(refundPercentFor(TIERS, -1)).toBe(0);
  });

  it("sorts tiers so the order they were entered does not matter", () => {
    const reversed: RefundTier[] = [
      { daysBefore: 14, percent: 50 },
      { daysBefore: 30, percent: 100 },
    ];
    expect(refundPercentFor(reversed, 45)).toBe(100);
    expect(refundPercentFor(reversed, 20)).toBe(50);
  });

  it("ignores tiers with out-of-range percentages", () => {
    const bad: RefundTier[] = [{ daysBefore: 30, percent: 150 }, { daysBefore: 10, percent: 25 }];
    expect(refundPercentFor(bad, 60)).toBe(25);
  });
});

describe("refundAmountCents", () => {
  it("returns the whole amount paid on a full refund", () => {
    expect(refundAmountCents(TIERS, 13455, 45)).toBe(13455);
  });

  it("rounds a partial refund to the nearest cent", () => {
    // 50% of $134.55 is $67.275, which must not leak a fraction of a cent.
    expect(refundAmountCents(TIERS, 13455, 20)).toBe(6728);
  });

  it("is zero outside every window", () => {
    expect(refundAmountCents(TIERS, 13455, 3)).toBe(0);
  });

  it("is zero on a free entry", () => {
    expect(refundAmountCents(TIERS, 0, 45)).toBe(0);
  });
});

describe("daysUntil", () => {
  it("counts whole days between two ISO dates", () => {
    expect(daysUntil("2026-09-20", "2026-08-30")).toBe(21);
  });

  it("is zero on the day of the event", () => {
    expect(daysUntil("2026-08-30", "2026-08-30")).toBe(0);
  });

  it("goes negative once the event has passed", () => {
    expect(daysUntil("2026-08-29", "2026-08-30")).toBe(-1);
  });

  it("crosses a month boundary correctly", () => {
    expect(daysUntil("2026-03-01", "2026-02-27")).toBe(2);
  });
});

describe("describeTiers", () => {
  it("describes each window and closes off the tail", () => {
    expect(describeTiers(TIERS)).toEqual([
      "30+ days before: full refund.",
      "14 to 29 days before: 50% back.",
      "Under 14 days before: no refund.",
    ]);
  });

  it("says so plainly when there are no refunds", () => {
    expect(describeTiers([])).toEqual(["No refunds at any time."]);
  });

  it("omits the tail line when the last tier runs to race day", () => {
    expect(describeTiers([{ daysBefore: 0, percent: 100 }])).toEqual([
      "Any time before the event: full refund.",
    ]);
  });

  it("does not describe a 0-day tier as a numbered window", () => {
    expect(describeTiers([{ daysBefore: 30, percent: 100 }, { daysBefore: 0, percent: 50 }])).toEqual([
      "30+ days before: full refund.",
      "Under 30 days before: 50% back.",
    ]);
  });
});

describe("matchRefundPreset", () => {
  it("recognises each preset it ships with", () => {
    for (const preset of REFUND_PRESETS) {
      expect(matchRefundPreset(preset.tiers)?.id).toBe(preset.id);
    }
  });

  it("matches regardless of the order the tiers arrive in", () => {
    expect(matchRefundPreset([{ daysBefore: 14, percent: 50 }, { daysBefore: 30, percent: 100 }])?.id)
      .toBe("tiered");
  });

  it("treats an empty policy as the no-refunds preset", () => {
    expect(matchRefundPreset([])?.id).toBe("none");
  });

  it("returns null for a bespoke policy so it is kept, not snapped to a preset", () => {
    expect(matchRefundPreset([{ daysBefore: 21, percent: 100 }, { daysBefore: 7, percent: 50 }])).toBeNull();
  });

  it("every preset is a valid policy", () => {
    for (const preset of REFUND_PRESETS) {
      expect(tiersAreValid(preset.tiers)).toBe(true);
    }
  });
});

describe("parseTiers", () => {
  it("reads tiers back off a JSON column", () => {
    expect(parseTiers([{ daysBefore: 30, percent: 100 }])).toEqual([
      { daysBefore: 30, percent: 100 },
    ]);
  });

  it.each([null, undefined, "no refunds", 42, {}])("returns empty for %s", (value) => {
    expect(parseTiers(value)).toEqual([]);
  });

  it("drops malformed entries rather than throwing", () => {
    expect(parseTiers([{ daysBefore: "30", percent: 100 }, { daysBefore: 14, percent: 50 }]))
      .toEqual([{ daysBefore: 14, percent: 50 }]);
  });
});

describe("parseLegacyPolicy", () => {
  it("maps the full-refund preset onto a tier", () => {
    expect(parseLegacyPolicy("Full refund 30+ days out")).toEqual({
      tiers: [{ daysBefore: 30, percent: 100 }],
      notes: "",
    });
  });

  it("maps the half-refund preset, en dash or hyphen", () => {
    const expected = { tiers: [{ daysBefore: 14, percent: 50 }], notes: "" };
    expect(parseLegacyPolicy("50% refund 14–30 days")).toEqual(expected);
    expect(parseLegacyPolicy("50% refund 14-30 days")).toEqual(expected);
  });

  it("leaves the retired deferrals label in the notes instead of dropping it", () => {
    // Deferrals are no longer modelled, so the phrase is not a preset any more.
    // It must survive as notes rather than being silently stripped.
    expect(parseLegacyPolicy("Deferrals accepted")).toBeNull();
    expect(parseLegacyPolicy("No refunds. Deferrals accepted")).toEqual({
      tiers: [],
      notes: "Deferrals accepted",
    });
  });

  it("maps no-refunds onto an empty tier list", () => {
    expect(parseLegacyPolicy("No refunds")).toEqual({
      tiers: [],
      notes: "",
    });
  });

  it("handles the concatenated presets the old form produced", () => {
    const result = parseLegacyPolicy("Full refund 30+ days out. 50% refund 14–30 days");
    expect(result).toEqual({
      tiers: [
        { daysBefore: 30, percent: 100 },
        { daysBefore: 14, percent: 50 },
      ],
      notes: "",
    });
  });

  it("keeps trailing custom text as notes", () => {
    const result = parseLegacyPolicy("Full refund 30+ days out. Injury exemptions at our discretion");
    expect(result?.tiers).toEqual([{ daysBefore: 30, percent: 100 }]);
    expect(result?.notes).toBe("Injury exemptions at our discretion");
  });

  it("returns null for text matching no preset, so it stays as notes", () => {
    expect(parseLegacyPolicy("Email us and we'll sort something out")).toBeNull();
    expect(parseLegacyPolicy("")).toBeNull();
  });
});

describe("DEFAULT_REFUND_TIERS", () => {
  it("is a coherent policy out of the box", () => {
    expect(refundPercentFor(DEFAULT_REFUND_TIERS, 40)).toBe(100);
    expect(refundPercentFor(DEFAULT_REFUND_TIERS, 20)).toBe(50);
    expect(refundPercentFor(DEFAULT_REFUND_TIERS, 5)).toBe(0);
  });
});
