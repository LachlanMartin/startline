import { describe, it, expect } from "vitest";
import { formatDivisionLabel, selectionLabel } from "@/lib/divisions";

describe("formatDivisionLabel", () => {
  it.each([
    ["10K", "10km"],
    ["5K", "5km"],
    ["1K", "1km"],
    ["2.4K Swim", "2.4km Swim"],
    ["10K Trail", "10km Trail"],
    ["5K Fun Run", "5km Fun Run"],
    ["160K Gran Fondo", "160km Gran Fondo"],
  ])("spells %s out as %s", (input, expected) => {
    expect(formatDivisionLabel(input)).toBe(expected);
  });

  it.each([
    "Half Marathon", "Marathon", "Ultra", "Ironman", "70.3",
    "Elite Men", "Open Water", "Gran Fondo", "Sprint",
  ])("leaves the word division %s alone", (input) => {
    expect(formatDivisionLabel(input)).toBe(input);
  });

  it.each(["50m", "400m Junior", "1500m", "600m"])(
    "leaves the metre distance %s alone", (input) => {
      expect(formatDivisionLabel(input)).toBe(input);
    });

  it("does not touch a K that is part of a word", () => {
    // "10Kg" is not a distance, and neither is a bare word starting with K.
    expect(formatDivisionLabel("10Kg Carry")).toBe("10Kg Carry");
    expect(formatDivisionLabel("Kayak")).toBe("Kayak");
  });
});

describe("selectionLabel", () => {
  it("joins the discipline and division for the search field", () => {
    expect(selectionLabel("Running", "10K")).toBe("Running - 10km");
    expect(selectionLabel("Running", "Half Marathon")).toBe("Running - Half Marathon");
  });

  it("is just the discipline when no division is picked", () => {
    expect(selectionLabel("Running", null)).toBe("Running");
    expect(selectionLabel("Cycling")).toBe("Cycling");
  });
});
