import { describe, it, expect } from "vitest";
import { pickActiveMembership } from "@/lib/active-organiser";

type M = { organiserId: string; role: "OWNER" | "MANAGER" };

const memberships: M[] = [
  { organiserId: "apex",    role: "MANAGER" },
  { organiserId: "coastal", role: "MANAGER" },
];

describe("pickActiveMembership", () => {
  it("returns null for no memberships", () => {
    expect(pickActiveMembership([])).toBeNull();
  });

  it("returns the single membership", () => {
    expect(pickActiveMembership([{ organiserId: "apex", role: "OWNER" }])?.organiserId).toBe("apex");
  });

  it("prefers the cookie organiser", () => {
    expect(pickActiveMembership(memberships, "coastal")?.organiserId).toBe("coastal");
  });

  it("prefers an OWNER when the cookie is stale or missing", () => {
    const roster: M[] = [
      { organiserId: "apex", role: "MANAGER" },
      { organiserId: "coastal", role: "OWNER" },
    ];
    expect(pickActiveMembership(roster, "stale-id")?.organiserId).toBe("coastal");
    expect(pickActiveMembership(roster, undefined)?.organiserId).toBe("coastal");
  });

  it("falls back to the first membership for a MANAGER-only user without a cookie", () => {
    expect(pickActiveMembership(memberships, undefined)?.organiserId).toBe("apex");
    expect(pickActiveMembership(memberships, "does-not-exist")?.organiserId).toBe("apex");
  });
});
