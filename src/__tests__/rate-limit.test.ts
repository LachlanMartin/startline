import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  default: { $queryRaw: vi.fn() },
}));

import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

const queryRaw = prisma.$queryRaw as ReturnType<typeof vi.fn>;

function makeRequest() {
  return new NextRequest("http://localhost:3000/api/contact", {
    headers: { "x-forwarded-for": "203.0.113.9" },
  });
}

describe("rateLimit", () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("returns 429 with Retry-After and X-RateLimit-* headers when blocked", async () => {
    const resetAt = new Date(Date.now() + 30_000);
    queryRaw.mockResolvedValue([{ count: 4, resetAt }]);

    const res = await rateLimit(makeRequest(), { prefix: "contact", limit: 3, windowSeconds: 60 });

    expect(res?.status).toBe(429);
    expect(res?.headers.get("Retry-After")).toBe("30");
    expect(res?.headers.get("X-RateLimit-Limit")).toBe("3");
    expect(res?.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("lets requests through under the limit", async () => {
    queryRaw.mockResolvedValue([{ count: 2, resetAt: new Date() }]);

    const res = await rateLimit(makeRequest(), { prefix: "contact", limit: 3, windowSeconds: 60 });

    expect(res).toBeNull();
  });

  it("fails open when the database is unreachable", async () => {
    queryRaw.mockRejectedValue(new Error("db down"));

    const res = await rateLimit(makeRequest(), { prefix: "contact", limit: 3, windowSeconds: 60 });

    expect(res).toBeNull();
  });
});
