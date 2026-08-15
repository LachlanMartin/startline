import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getOrganiserSession: vi.fn(),
  getUserSession: vi.fn(),
  memberFindFirst: vi.fn(),
  memberUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/amplify-server", () => ({
  getOrganiserSession: mocks.getOrganiserSession,
  getUserSession: mocks.getUserSession,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    organiserMember: {
      findFirst: mocks.memberFindFirst,
      update: mocks.memberUpdate,
    },
    $transaction: mocks.transaction,
  },
}));

import { POST } from "@/app/api/organiser/members/[id]/transfer-ownership/route";

function post(memberId = "member-1") {
  const req = new NextRequest("http://localhost/api/organiser/members/member-1/transfer-ownership", {
    method: "POST",
  });
  return POST(req, { params: Promise.resolve({ id: memberId }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getOrganiserSession.mockResolvedValue({
    sub: "org-1", email: "owner@example.com", status: "APPROVED", verified: true, role: "OWNER",
  });
  mocks.getUserSession.mockResolvedValue({ sub: "user-owner", email: "owner@example.com", name: "Owner" });
  mocks.memberUpdate.mockImplementation((args: unknown) => args);
  mocks.transaction.mockImplementation((ops: unknown[]) => Promise.resolve(ops));
});

describe("POST /api/organiser/members/[id]/transfer-ownership", () => {
  it("demotes the caller's own membership, not the oldest owner", async () => {
    mocks.memberFindFirst.mockImplementation(async ({ where }) => {
      if (where.role === "OWNER") return null; // old buggy query must not run
      if (where.userId) return { id: "caller-membership", role: "OWNER" };
      return { id: "member-target", role: "MANAGER" };
    });

    await post();

    expect(mocks.memberFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { organiserId: "org-1", userId: "user-owner" },
    }));
    expect(mocks.memberFindFirst).not.toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ role: "OWNER" }),
    }));

    const [targetUpdate, callerUpdate] = mocks.transaction.mock.calls[0][0];
    expect(targetUpdate).toMatchObject({ where: { id: "member-target" }, data: { role: "OWNER" } });
    expect(callerUpdate).toMatchObject({ where: { id: "caller-membership" }, data: { role: "MANAGER" } });
  });

  it("rejects non-owners", async () => {
    mocks.getOrganiserSession.mockResolvedValue({
      sub: "org-1", email: "m@example.com", status: "APPROVED", verified: true, role: "MANAGER",
    });

    const res = await post();
    expect(res.status).toBe(403);
    expect(mocks.memberFindFirst).not.toHaveBeenCalled();
  });

  it("returns 404 when the target member is not in the caller's organiser", async () => {
    mocks.memberFindFirst.mockResolvedValue(null);

    const res = await post();
    expect(res.status).toBe(404);
  });
});
