import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slugs";

describe("slugify", () => {
  it("lowercases, dashes separators, strips special chars", () => {
    expect(slugify("The Apex Throwdown 2026")).toBe("the-apex-throwdown-2026");
    expect(slugify("Sydney Harbour 10K")).toBe("sydney-harbour-10k");
    expect(slugify("Bondi to Bronte Ocean Swim")).toBe("bondi-to-bronte-ocean-swim");
  });

  it("collapses runs of non-alphanumeric chars into a single dash", () => {
    expect(slugify("Hybrid Hustle Series — Round 3")).toBe("hybrid-hustle-series-round-3");
    expect(slugify("F45   Championship   World Final")).toBe("f45-championship-world-final");
  });

  it("trims leading/trailing dashes and falls back when empty", () => {
    expect(slugify("— 2026!")).toBe("2026");
    expect(slugify("   ")).toBe("event");
    expect(slugify("!!!")).toBe("event");
  });

  it("truncates to ~80 chars without a trailing dash", () => {
    const long = "A".repeat(120);
    expect(slugify(long)).toBe("a".repeat(80));
    expect(slugify("Supercalifragilisticexpialidocious " + "A".repeat(90))).toHaveLength(80);
    expect(slugify("Word ".repeat(30)).endsWith("-")).toBe(false);
  });
});
