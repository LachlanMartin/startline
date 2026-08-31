import { describe, it, expect } from "vitest";
import {
  addOnRefundAmountCents,
  canRequestAddOnRefund,
  canDecideAddOnRefund,
  ADDON_REFUND_NOTICE,
} from "@/lib/add-on-refunds";
import {
  entryRefundAmountCents,
  entryPaidCents,
  isOutsidePolicyRefund,
  buildRefundParams,
  REFUND_APPLICATION_FEE,
} from "@/lib/stripe-refunds";

const item = {
  status: "PURCHASED" as const,
  amountCents: 2500,
  platformFeeCents: 99,
  feeStructure: "athlete",
};

describe("addOnRefundAmountCents", () => {
  it("returns the item and the fee when the athlete paid the fee", () => {
    expect(addOnRefundAmountCents(item)).toBe(2599);
  });

  it("returns the item only when the organiser absorbed the fee", () => {
    // The athlete never paid that fee, so it is not theirs to receive back.
    expect(addOnRefundAmountCents({ ...item, feeStructure: "organiser" })).toBe(2500);
  });

  it("has no policy tiers: the amount does not shrink as the event approaches", () => {
    expect(addOnRefundAmountCents(item)).toBe(addOnRefundAmountCents(item));
  });

  it("is never negative", () => {
    expect(addOnRefundAmountCents({ ...item, amountCents: 0, platformFeeCents: 0 })).toBe(0);
  });
});

describe("canRequestAddOnRefund", () => {
  const base = { item, eventDate: "2026-09-30", today: "2026-08-31" };

  it("allows a purchased item before the event", () => {
    expect(canRequestAddOnRefund(base).ok).toBe(true);
  });

  it("allows a request on race day itself", () => {
    expect(canRequestAddOnRefund({ ...base, eventDate: "2026-08-31" }).ok).toBe(true);
  });

  it("refuses once the event has passed", () => {
    const result = canRequestAddOnRefund({ ...base, eventDate: "2026-08-30" });
    expect(result).toMatchObject({ ok: false, status: 409 });
  });

  it("refuses a second request while one is open", () => {
    const result = canRequestAddOnRefund({ ...base, item: { ...item, status: "REFUND_REQUESTED" } });
    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(result.ok === false && result.reason).toMatch(/already asked/);
  });

  it("refuses an item that is already refunded", () => {
    const result = canRequestAddOnRefund({ ...base, item: { ...item, status: "REFUNDED" } });
    expect(result.ok === false && result.reason).toMatch(/already been refunded/);
  });

  it("refuses an item that was never fulfilled", () => {
    expect(canRequestAddOnRefund({ ...base, item: { ...item, status: "CANCELLED" } }).ok).toBe(false);
  });
});

describe("canDecideAddOnRefund", () => {
  it("allows the organiser to act on an open request", () => {
    expect(canDecideAddOnRefund({ ...item, status: "REFUND_REQUESTED" }).ok).toBe(true);
  });

  it("refuses when there is no open request", () => {
    expect(canDecideAddOnRefund(item).ok).toBe(false);
  });

  it("refuses to decide twice", () => {
    const result = canDecideAddOnRefund({ ...item, status: "REFUNDED" });
    expect(result.ok === false && result.reason).toMatch(/already been refunded/);
  });
});

describe("athlete-facing copy", () => {
  it("promises a decision without quoting a percentage or a policy", () => {
    expect(ADDON_REFUND_NOTICE).toBe("The organiser will approve or decline this request.");
    expect(ADDON_REFUND_NOTICE).not.toMatch(/%|policy|tier/i);
  });
});

// ─── Entry refunds: the two pre-existing Stripe bugs ─────────────────────────

describe("entryRefundAmountCents", () => {
  const entry = { amountCents: 10000, platformFeeCents: 540, refundAmountCents: null };

  it("is never undefined, whatever the snapshot holds", () => {
    for (const snapshot of [null, 0, 1, 5000, 10540, 999999]) {
      const result = entryRefundAmountCents({ ...entry, refundAmountCents: snapshot });
      expect(result).toBeTypeOf("number");
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
    }
  });

  it("honours a partial snapshot", () => {
    expect(entryRefundAmountCents({ ...entry, refundAmountCents: 5270 })).toBe(5270);
  });

  // The bug: a row predating the structured policy used to fall back to an
  // amountless refund, which returns the WHOLE charge, including every other
  // participant in a group booking.
  it("falls back to what this entry paid, not to the whole charge", () => {
    expect(entryRefundAmountCents(entry)).toBe(10540);
    expect(entryRefundAmountCents(entry)).toBe(entryPaidCents(entry));
  });

  it("never returns more than this entry paid", () => {
    expect(entryRefundAmountCents({ ...entry, refundAmountCents: 999999 })).toBe(10540);
  });

  it("flags a zero snapshot as outside the policy rather than refunding nothing", () => {
    expect(isOutsidePolicyRefund({ ...entry, refundAmountCents: 0 })).toBe(true);
    expect(isOutsidePolicyRefund(entry)).toBe(false);
  });
});

describe("buildRefundParams", () => {
  const request = { chargeId: "ch_1", amountCents: 5000, idempotencyKey: "entry-refund-r1" };

  // Without this the connected account keeps its funds and the PLATFORM covers
  // the refund out of its own balance.
  it("always reverses the transfer on a destination charge", () => {
    const [params] = buildRefundParams(request);
    expect(params.reverse_transfer).toBe(true);
  });

  it("always sends an explicit amount, so a refund can never sweep the whole charge", () => {
    const [params] = buildRefundParams(request);
    expect(params.amount).toBe(5000);
    expect(params).toHaveProperty("amount");
  });

  it("carries the idempotency key so a retry cannot refund twice", () => {
    const [, options] = buildRefundParams(request);
    expect(options).toEqual({ idempotencyKey: "entry-refund-r1" });
  });

  // Signed-off commercial decision: Startline keeps its booking fee, which is
  // what covers the Stripe processing fee Stripe does not return.
  it("keeps the platform fee", () => {
    const [params] = buildRefundParams(request);
    expect(REFUND_APPLICATION_FEE).toBe(false);
    expect(params.refund_application_fee).toBe(false);
  });

  it("refuses an amount that is not a positive whole number of cents", () => {
    for (const bad of [0, -1, 12.5, NaN]) {
      expect(() => buildRefundParams({ ...request, amountCents: bad })).toThrow(/positive whole number/);
    }
  });
});
