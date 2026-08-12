import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const limitMock = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(() => ({})),
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: Object.assign(
    vi.fn().mockImplementation(function (this: { limit: typeof limitMock }) {
      this.limit = limitMock;
    }),
    { fixedWindow: vi.fn(() => ({})) },
  ),
}));

function makeRequest() {
  return new NextRequest("http://localhost:3000/api/contact", {
    headers: { "x-forwarded-for": "203.0.113.9" },
  });
}

describe("rateLimit", () => {
  beforeEach(() => {
    limitMock.mockReset();
    vi.resetModules();
  });

  it("returns 429 with Retry-After and X-RateLimit-* headers when blocked", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    limitMock.mockResolvedValue({
      success: false,
      limit: 3,
      remaining: 0,
      reset: Date.now() + 30_000,
    });

    const { rateLimit } = await import("@/lib/rate-limit");
    const res = await rateLimit(makeRequest(), { prefix: "contact", limit: 3, window: "60 s" });

    expect(res?.status).toBe(429);
    expect(res?.headers.get("Retry-After")).toBe("30");
    expect(res?.headers.get("X-RateLimit-Limit")).toBe("3");
    expect(res?.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("lets requests through when Upstash is not configured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const { rateLimit } = await import("@/lib/rate-limit");
    const res = await rateLimit(makeRequest(), { prefix: "contact", limit: 3, window: "60 s" });

    expect(res).toBeNull();
  });
});
