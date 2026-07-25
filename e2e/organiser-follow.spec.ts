import { test, expect } from "@playwright/test";

test.describe("public organiser profile follow + stats", () => {
  test("shows follow CTA and registration / follower / events counts", async ({ page }) => {
    const eventsRes = await page.request.get("/api/events");
    expect(eventsRes.ok()).toBeTruthy();
    const events = await eventsRes.json();
    expect(Array.isArray(events) && events.length > 0).toBeTruthy();

    const organiserId = events.find((e: { organiserId?: string }) => e.organiserId)?.organiserId;
    expect(organiserId).toBeTruthy();

    await page.goto(`/organisers/${organiserId}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: /follow/i })).toBeVisible();
    await expect(page.getByText("Registrations", { exact: true })).toBeVisible();
    await expect(page.getByText("Followers", { exact: true })).toBeVisible();
    await expect(page.getByText("Events hosted", { exact: true })).toBeVisible();
  });
});
