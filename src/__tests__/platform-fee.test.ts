import { describe, it, expect } from "vitest";
import {
  PLATFORM_FEE_PERCENT,
  PLATFORM_FEE_FIXED_CENTS,
  calculatePlatformFee,
  calculateTotalWithFee,
} from "@/lib/platform-fee";

describe("calculatePlatformFee", () => {
  // The fee is a share of a sale, not a subscription: charging the fixed
  // component on a free ticket would bill the athlete A$1.45 to enter a free
  // event, or hand Stripe a fee bigger than the charge (issue #308).
  it("charges nothing on a free ticket", () => {
    expect(calculatePlatformFee(0)).toBe(0);
  });

  it("charges nothing on a nonsensical negative amount", () => {
    expect(calculatePlatformFee(-500)).toBe(0);
  });

  it("applies the percentage plus the fixed fee", () => {
    const amount = 10000; // $100.00
    expect(calculatePlatformFee(amount)).toBe(
      Math.round(amount * PLATFORM_FEE_PERCENT) + PLATFORM_FEE_FIXED_CENTS
    );
  });

  it("rounds the percentage component to the nearest cent", () => {
    // 3.95% of $3.33 → 13.15 → 13, plus 145 fixed.
    expect(calculatePlatformFee(333)).toBe(13 + PLATFORM_FEE_FIXED_CENTS);
  });

  it("handles large amounts", () => {
    expect(calculatePlatformFee(7500000)).toBe(
      Math.round(7500000 * PLATFORM_FEE_PERCENT) + PLATFORM_FEE_FIXED_CENTS
    );
  });
});

describe("calculateTotalWithFee — athlete pays", () => {
  it("adds the fee on top of the ticket price", () => {
    const { totalCents, platformFeeCents } = calculateTotalWithFee(10000, "athlete");
    expect(platformFeeCents).toBe(540);
    expect(totalCents).toBe(10540);
  });

  it("never exceeds the sum of price and fee", () => {
    const price = 5000;
    const { totalCents, platformFeeCents } = calculateTotalWithFee(price, "athlete");
    expect(totalCents).toBe(price + platformFeeCents);
  });
});

describe("calculateTotalWithFee — organiser pays", () => {
  it("keeps the ticket price as the total the athlete pays", () => {
    const { totalCents, platformFeeCents } = calculateTotalWithFee(10000, "organiser");
    expect(platformFeeCents).toBe(540);
    expect(totalCents).toBe(10000);
  });
});

describe("calculateTotalWithFee — free ticket", () => {
  it("costs nothing under either fee structure", () => {
    expect(calculateTotalWithFee(0, "athlete")).toEqual({ totalCents: 0, platformFeeCents: 0 });
    expect(calculateTotalWithFee(0, "organiser")).toEqual({ totalCents: 0, platformFeeCents: 0 });
  });
});
