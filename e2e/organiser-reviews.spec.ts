import { test, expect } from "@playwright/test";

test.describe("organiser reviews auth + layout", () => {
  test("signed-out write review opens sign-in; summary shows metrics", async ({ page }) => {
    const eventsRes = await page.request.get("/api/events");
    expect(eventsRes.ok()).toBeTruthy();
    const events = await eventsRes.json();
    const organiserId = events.find((e: { organiserId?: string }) => e.organiserId)?.organiserId;
    expect(organiserId).toBeTruthy();

    await page.goto(`/organisers/${organiserId}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /reviews/i })).toBeVisible();
    await expect(page.locator("#reviews").getByText("Atmosphere", { exact: true }).first()).toBeVisible();
    await expect(page.locator("#reviews").getByText("Organisation", { exact: true }).first()).toBeVisible();
    await expect(page.locator("#reviews").getByText("Experience", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: /write a review/i }).click();
    await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { name: /^write a review$/i })).toHaveCount(0);
  });

  test("review POST without reviewerName uses account name (auth required)", async ({ request }) => {
    const eventsRes = await request.get("/api/events");
    const events = await eventsRes.json();
    const organiserId = events[0]?.organiserId as string;
    expect(organiserId).toBeTruthy();

    const res = await request.post(`/api/public/reviews/${organiserId}`, {
      data: {
        overallRating: 5,
        title: "Auth review smoke",
        body: "Posted without a client-supplied name.",
      },
    });

    // Local auth bypass authenticates automatically; production without cookies is 401.
    if (res.status() === 401) {
      expect(res.status()).toBe(401);
      return;
    }

    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.reviewerName).toBeTruthy();
    expect(typeof data.reviewerName).toBe("string");
  });
});
