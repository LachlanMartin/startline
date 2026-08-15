import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/client-ip", () => ({
  getClientIp: vi.fn(() => "203.0.113.9"),
}));
vi.mock("@/lib/security-event", () => ({
  recordSecurityEvent: vi.fn(),
}));

import { verifyTurnstileToken, assertTurnstile } from "@/lib/turnstile";
import { recordSecurityEvent } from "@/lib/security-event";

const recordMock = recordSecurityEvent as ReturnType<typeof vi.fn>;

function makeRequest() {
  return new NextRequest("http://localhost:3000/api/contact", {
    headers: { "x-forwarded-for": "203.0.113.9" },
  });
}

describe("verifyTurnstileToken", () => {
  const originalSecret = process.env.TURNSTILE_SECRET_KEY;

  beforeEach(() => {
    recordMock.mockReset();
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = originalSecret;
    vi.restoreAllMocks();
  });

  it("fails open when no secret is configured (dev/test)", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    expect(await verifyTurnstileToken(undefined, makeRequest())).toBe(true);
    expect(await verifyTurnstileToken("", makeRequest())).toBe(true);
  });

  it("rejects a missing token when configured", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    expect(await verifyTurnstileToken(null, makeRequest())).toBe(false);
    expect(await verifyTurnstileToken("", makeRequest())).toBe(false);
  });

  it("accepts a token when siteverify succeeds", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ success: true }),
    }));
    expect(await verifyTurnstileToken("token", makeRequest())).toBe(true);
  });

  it("rejects a token when siteverify fails", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ success: false, "error-codes": ["invalid-input-response"] }),
    }));
    expect(await verifyTurnstileToken("bad-token", makeRequest())).toBe(false);
  });

  it("fails closed when siteverify is unreachable", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    expect(await verifyTurnstileToken("token", makeRequest())).toBe(false);
  });
});

describe("assertTurnstile", () => {
  const originalSecret = process.env.TURNSTILE_SECRET_KEY;

  beforeEach(() => {
    recordMock.mockReset();
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = originalSecret;
    vi.restoreAllMocks();
  });

  it("returns null when the token verifies", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ success: true }),
    }));
    const res = await assertTurnstile(makeRequest(), { turnstileToken: "token" }, "contact");
    expect(res).toBeNull();
    expect(recordMock).not.toHaveBeenCalled();
  });

  it("returns a 400 and records a SecurityEvent when verification fails", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ success: false }),
    }));
    const res = await assertTurnstile(makeRequest(), { turnstileToken: "bad" }, "contact");
    expect(res?.status).toBe(400);
    expect(recordMock).toHaveBeenCalledWith(expect.objectContaining({
      type: "bot_check_failed",
      action: "contact",
      ip: "203.0.113.9",
    }));
  });

  it("passes through when Turnstile is unconfigured", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const res = await assertTurnstile(makeRequest(), { turnstileToken: undefined }, "contact");
    expect(res).toBeNull();
    expect(recordMock).not.toHaveBeenCalled();
  });
});
