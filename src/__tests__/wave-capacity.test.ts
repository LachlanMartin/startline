import { describe, it, expect } from "vitest";
import { capacityState, previewMove } from "@/lib/wave-capacity";
import { countsAgainstCapacity, CAPACITY_COUNTING_STATUSES } from "@/lib/registration-status";

describe("capacityState", () => {
  it("treats a null capacity as unlimited (always normal)", () => {
    expect(capacityState(0, null)).toBe("normal");
    expect(capacityState(9999, null)).toBe("normal");
  });

  it("flags over-capacity when assigned exceeds the cap", () => {
    expect(capacityState(251, 250)).toBe("over");
    expect(capacityState(1, 0)).toBe("over"); // zero-cap wave with someone in it
  });

  it("flags near-capacity at or above 90% of a finite cap", () => {
    expect(capacityState(225, 250)).toBe("near"); // exactly 90%
    expect(capacityState(250, 250)).toBe("near"); // full is near, not over
    expect(capacityState(224, 250)).toBe("normal"); // just under 90%
  });

  it("is normal well below the cap", () => {
    expect(capacityState(10, 250)).toBe("normal");
    expect(capacityState(0, 250)).toBe("normal");
  });
});

describe("previewMove", () => {
  it("adds the moving athletes to the current occupancy", () => {
    expect(previewMove({ destCapacity: 100, destAssignedNow: 40, movingCount: 5 }))
      .toEqual({ resulting: 45, over: false, overBy: 0 });
  });

  it("reports over-capacity and by how much, without blocking", () => {
    expect(previewMove({ destCapacity: 50, destAssignedNow: 48, movingCount: 5 }))
      .toEqual({ resulting: 53, over: true, overBy: 3 });
  });

  it("never reports over-capacity for an unlimited wave", () => {
    expect(previewMove({ destCapacity: null, destAssignedNow: 500, movingCount: 100 }))
      .toEqual({ resulting: 600, over: false, overBy: 0 });
  });
});

describe("countsAgainstCapacity", () => {
  it("counts only paid (CONFIRMED) registrations for now", () => {
    expect(countsAgainstCapacity("CONFIRMED")).toBe(true);
    expect(countsAgainstCapacity("CANCELLED")).toBe(false);
    expect(countsAgainstCapacity("REFUNDED")).toBe(false);
    expect(CAPACITY_COUNTING_STATUSES).toEqual(["CONFIRMED"]);
  });
});
