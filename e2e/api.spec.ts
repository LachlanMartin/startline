import { test, expect } from "@playwright/test";

test.describe("checkout API", () => {
  test("POST /api/checkout returns 400 for missing fields", async ({ request }) => {
    const res = await request.post("/api/checkout", {
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("First name is required");
  });

  test("POST /api/checkout returns 404 for non-existent event", async ({ request }) => {
    const res = await request.post("/api/checkout", {
      data: {
        eventId: "non-existent-id",
        waveLabel: "Early Bird",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        mobile: "0400000000",
        emergencyContactName: "Emergency",
        emergencyContactPhone: "0400000001",
        waiverAccepted: true,
        dateOfBirth: "1990-01-01",
      },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Event not found");
  });
});

test.describe("availability API", () => {
  test("GET /api/events/[id]/availability returns cap + per-tier confirmed counts", async ({ request }) => {
    const res = await request.get("/api/events/seed-event-001/availability");
    expect(res.status()).toBe(200);
    const body = await res.json();
    // cap is a number or null; confirmed is a count; waves carry qty + confirmed.
    expect(body).toHaveProperty("confirmed");
    expect(typeof body.confirmed).toBe("number");
    expect(Array.isArray(body.waves)).toBe(true);
    if (body.waves.length > 0) {
      const w = body.waves[0];
      expect(w).toHaveProperty("label");
      expect(w).toHaveProperty("qty");
      expect(w).toHaveProperty("confirmed");
      expect(typeof w.confirmed).toBe("number");
    }
  });

  test("GET /api/events/[id]/availability returns 404 for a non-existent event", async ({ request }) => {
    const res = await request.get("/api/events/non-existent-id/availability");
    expect(res.status()).toBe(404);
  });
});

test.describe("stripe webhook", () => {
  // Stripe webhook secret differs in CI — test locally only
  const stripeWebhookTest = process.env.CI ? test.skip : test;
  stripeWebhookTest("POST /api/stripe/webhook returns 400 without signature", async ({ request }) => {
    const res = await request.post("/api/stripe/webhook", {
      data: { type: "payment_intent.succeeded" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

test.describe("profile API", () => {
  // Bypass is cookie-based now, not env-var-based. Without the __e2e_bypass
  // cookie this endpoint returns 401.
  test("GET /api/organiser/profile", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
    const res = await ctx.get("/api/organiser/profile");
    expect(res.status()).toBe(401);
    const body = await res.json();
    // 401 is specifically "no Cognito session" now. A signed-in account that
    // manages no organiser gets 403/NO_ORGANISER instead, so assert the code
    // rather than prose that shifts whenever the message is reworded.
    expect(body.code).toBe("UNAUTHENTICATED");
    expect(body.error).toContain("sign in again");
    await ctx.dispose();
  });
});
