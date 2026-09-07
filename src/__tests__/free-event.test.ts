import { describe, it, expect } from "vitest";
import { isFreeEvent } from "@/lib/event-types";

// A free event asks for no refund policy and shows none (issue #304), so what
// counts as free has to be exact: every category free, and nothing half-filled.
describe("isFreeEvent", () => {
  it("is true when every ticket category is free", () => {
    expect(isFreeEvent([{ label: "General", price: "0" }, { label: "Junior", price: "0.00" }])).toBe(true);
  });

  it("is false when any category is priced", () => {
    expect(isFreeEvent([{ label: "General", price: "0" }, { label: "VIP", price: "45" }])).toBe(false);
  });

  it("is false for a category with no price yet", () => {
    expect(isFreeEvent([{ label: "General", price: "" }])).toBe(false);
    expect(isFreeEvent([{ label: "General" }])).toBe(false);
  });

  it("is false with no categories at all", () => {
    expect(isFreeEvent([])).toBe(false);
    expect(isFreeEvent(null)).toBe(false);
    expect(isFreeEvent(undefined)).toBe(false);
  });
});
