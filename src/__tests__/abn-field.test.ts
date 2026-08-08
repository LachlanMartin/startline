import { describe, expect, it } from "vitest";
import { isAbnAcceptableForPaid } from "@/lib/abn";

describe("isAbnAcceptableForPaid", () => {
  it("accepts an active ABR match", () => {
    expect(
      isAbnAcceptableForPaid(
        {
          status: "found",
          entityName: "Test Pty Ltd",
          entityStatus: "Active",
          active: true,
        },
        "51 824 753 556",
      ),
    ).toBe(true);
  });

  it("rejects cancelled ABR matches", () => {
    expect(
      isAbnAcceptableForPaid(
        {
          status: "found",
          entityName: "Old Co",
          entityStatus: "Cancelled",
          active: false,
        },
        "51824753556",
      ),
    ).toBe(false);
  });

  it("allows 11-digit ABN when ABR is unavailable", () => {
    expect(
      isAbnAcceptableForPaid({ status: "unavailable", message: "down" }, "51824753556"),
    ).toBe(true);
    expect(
      isAbnAcceptableForPaid({ status: "unavailable", message: "down" }, "12345"),
    ).toBe(false);
  });

  it("rejects incomplete numbers while loading", () => {
    expect(isAbnAcceptableForPaid({ status: "loading" }, "51824753556")).toBe(false);
    expect(isAbnAcceptableForPaid({ status: "idle" }, "51824753556")).toBe(false);
  });
});
