import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { hasAbn } from "@/lib/abn";

const mocks = vi.hoisted(() => ({
  getAdminSession: vi.fn(),
  eventFindUnique: vi.fn(),
  eventFindMany: vi.fn(),
  eventUpdateMany: vi.fn(),
  transaction: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/amplify-server", () => ({
  getAdminSession: mocks.getAdminSession,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    event: {
      findUnique: mocks.eventFindUnique,
      findMany:   mocks.eventFindMany,
      updateMany: mocks.eventUpdateMany,
      // The approve path builds its update inside $transaction, so this has to
      // exist even though the transaction itself is stubbed out.
      update:     vi.fn(),
    },
    notification: { create: vi.fn() },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/email", () => ({
  sendEventApprovedEmail: vi.fn().mockResolvedValue(undefined),
  sendEventRejectedEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/notify-organiser-followers", () => ({
  notifyOrganiserFollowers: vi.fn().mockResolvedValue(undefined),
}));

import { POST as review } from "@/app/api/admin/events/[id]/review/route";
import { POST as bulk } from "@/app/api/admin/events/bulk/route";

const ABN = "51 824 753 556";

const reviewReq = (action: string) =>
  review(
    new NextRequest("http://localhost/api/admin/events/e1/review", {
      method: "POST",
      body: JSON.stringify({ action, reason: action === "reject" ? "not suitable" : undefined }),
    }),
    { params: Promise.resolve({ id: "e1" }) },
  );

const bulkReq = (ids: string[], action = "approve") =>
  bulk(
    new NextRequest("http://localhost/api/admin/events/bulk", {
      method: "POST",
      body: JSON.stringify({ ids, action }),
    }),
  );

const pendingEvent = (over: Record<string, unknown> = {}) => ({
  id: "e1",
  title: "Trail Half",
  status: "PENDING",
  registrationType: "startline",
  eventDate: "2026-11-01",
  city: "Melbourne",
  organiser: {
    id: "org-1",
    email: "sarah@startline.test",
    orgName: "Apex",
    stripeOnboardingComplete: true,
    abn: ABN,
    ...(over.organiser as object ?? {}),
  },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.getAdminSession.mockResolvedValue({ sub: "admin-1" });
  mocks.transaction.mockResolvedValue([]);
});

describe("hasAbn", () => {
  it("accepts a formatted ABN", () => {
    expect(hasAbn(ABN)).toBe(true);
    expect(hasAbn("51824753556")).toBe(true);
  });

  it("rejects nothing, blanks and stray punctuation", () => {
    expect(hasAbn(null)).toBe(false);
    expect(hasAbn(undefined)).toBe(false);
    expect(hasAbn("")).toBe(false);
    expect(hasAbn("   ")).toBe(false);
    expect(hasAbn("-- --")).toBe(false);
  });

  it("rejects a value too short to be an ABN", () => {
    expect(hasAbn("12345678")).toBe(false);
    expect(hasAbn("123456789")).toBe(true);
  });
});

describe("POST /api/admin/events/[id]/review", () => {
  it("refuses to approve a marketplace event when the organiser has no ABN", async () => {
    mocks.eventFindUnique.mockResolvedValue(pendingEvent({ organiser: { abn: null } }));

    const res = await reviewReq("approve");
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.code).toBe("ABN_MISSING");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("approves when the organiser has an ABN", async () => {
    mocks.eventFindUnique.mockResolvedValue(pendingEvent());

    const res = await reviewReq("approve");

    expect(res.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalled();
  });

  // External registration takes no money through Startline, so the ABN the
  // rule protects is not needed.
  it("approves an externally-registered event without an ABN", async () => {
    mocks.eventFindUnique.mockResolvedValue(
      pendingEvent({ registrationType: "external", organiser: { abn: null } }),
    );

    const res = await reviewReq("approve");

    expect(res.status).toBe(200);
  });

  // Rejecting is how an admin clears an event that can never be approved, so
  // the ABN gate must not block it.
  it("still allows rejecting an event from an organiser with no ABN", async () => {
    mocks.eventFindUnique.mockResolvedValue(pendingEvent({ organiser: { abn: null } }));

    const res = await reviewReq("reject");

    expect(res.status).toBe(200);
  });
});

describe("POST /api/admin/events/bulk", () => {
  it("skips events whose organiser has no ABN and names them", async () => {
    mocks.eventFindMany.mockResolvedValue([
      { id: "e1", title: "Has ABN", registrationType: "startline",
        organiser: { abn: ABN, stripeOnboardingComplete: true } },
      { id: "e2", title: "No ABN", registrationType: "startline",
        organiser: { abn: null, stripeOnboardingComplete: true } },
    ]);
    mocks.eventUpdateMany.mockResolvedValue({ count: 1 });

    const res = await bulkReq(["e1", "e2"]);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.affected).toBe(1);
    expect(body.blocked).toEqual([{ id: "e2", title: "No ABN", reason: "No ABN on file" }]);
    expect(mocks.eventUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ["e1"] } }) }),
    );
  });

  // Bulk approve used to write straight through, so it could publish what the
  // single-approve route refuses.
  it("closes the Stripe bypass that bulk approve used to leave open", async () => {
    mocks.eventFindMany.mockResolvedValue([
      { id: "e1", title: "No Stripe", registrationType: "startline",
        organiser: { abn: ABN, stripeOnboardingComplete: false } },
    ]);
    mocks.eventUpdateMany.mockResolvedValue({ count: 0 });

    const body = await (await bulkReq(["e1"])).json();

    expect(body.affected).toBe(0);
    expect(body.blocked[0].reason).toBe("Stripe onboarding incomplete");
    expect(mocks.eventUpdateMany).not.toHaveBeenCalled();
  });

  it("does not filter a bulk reject", async () => {
    mocks.eventUpdateMany.mockResolvedValue({ count: 2 });

    const body = await (await bulk(
      new NextRequest("http://localhost/api/admin/events/bulk", {
        method: "POST",
        body: JSON.stringify({ ids: ["e1", "e2"], action: "reject", reason: "duplicate" }),
      }),
    )).json();

    expect(body.affected).toBe(2);
    expect(body.blocked).toEqual([]);
    expect(mocks.eventFindMany).not.toHaveBeenCalled();
  });
});
