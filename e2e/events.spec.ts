import { test, expect } from "@playwright/test";
import { argosScreenshot } from "@argos-ci/playwright";
import { goToHomepage } from "./helpers";

test.describe("events page", () => {
  test("renders events page with content", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main")).not.toBeEmpty();
  });

  test("events listing visual snapshot", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");
    await argosScreenshot(page, "events-listing");
  });

  test("search input is present", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");
    const searchInput = page.getByPlaceholder(/search|location|city/i);
    await expect(searchInput.first()).toBeVisible();
  });

  test("search toolbar is present", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Event", { exact: true })).toBeVisible();
    await expect(page.getByText("Where", { exact: true })).toBeVisible();
  });

  test("list/map view toggle is present", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("view-mode-list").first()).toBeVisible();
    await expect(page.getByTestId("view-mode-map").first()).toBeVisible();
  });

  test("switching to map mode shows map container", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("view-mode-map").first().click();
    await expect(page.getByTestId("events-map")).toBeVisible();
  });

  test("map renders when geolocation is granted", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"], { origin: "http://localhost:3000" });
    await context.setGeolocation({ latitude: -33.8688, longitude: 151.2093, accuracy: 5 });
    await page.goto("/events");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("view-mode-map").first().click();
    await expect(page.getByTestId("events-map")).toBeVisible();
  });
});

test.describe("event detail page", () => {
  test("event detail visual snapshot", async ({ page }) => {
    await page.goto("/events/seed-event-001");
    await page.waitForLoadState("networkidle");
    await argosScreenshot(page, "event-detail");
  });

  test("renders all event information PDFs as labelled downloads", async ({ page }) => {
    await page.goto("/events/seed-event-044");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /^Event information$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /course map/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /athlete guide/i })).toBeVisible();
  });

  test("shows organiser reviews section when reviews exist", async ({ page }) => {
    await page.goto("/events/seed-event-001");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /^Reviews$/i })).toBeVisible();
    await expect(page.getByText(/Apex Endurance Events/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /view all on organiser profile/i })).toBeVisible();
  });

  test("share control copies a clean slug URL", async ({ page, context }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/events/seed-event-001");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("button", { name: /share event/i })).toBeVisible();
    await page.getByRole("button", { name: /share event/i }).click();
    await page.getByRole("button", { name: /copy link/i }).click();
    await expect(page.getByRole("button", { name: /link copied/i })).toBeVisible();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toMatch(/\/events\/the-apex-throwdown-2026$/);
    expect(text).not.toContain("?");
  });

  test("event slug URL resolves to the event", async ({ page }) => {
    await page.goto("/events/sydney-harbour-10k");
    await expect(page.getByRole("heading", { level: 1, name: "Sydney Harbour 10K" })).toBeVisible({ timeout: 20000 });
  });

  test("legacy id URL still resolves to the same event", async ({ page }) => {
    await page.goto("/events/seed-event-005");
    await expect(page.getByRole("heading", { level: 1, name: "Sydney Harbour 10K" })).toBeVisible({ timeout: 20000 });
  });

  test("event card shows organiser name and rating", async ({ page }) => {
    await page.goto("/events?view=list");
    await page.waitForLoadState("networkidle");
    const organiserLink = page.getByRole("button", { name: /Apex Endurance Events/i }).first();
    await expect(organiserLink).toBeVisible();
    // Star rating chip is only rendered when the organiser has published reviews
    await expect(page.getByLabel(/Rated .+ out of 5 from \d+ reviews/i).first()).toBeVisible();
  });

  test("back to events button is visible and navigates to the listing", async ({ page }) => {
    await page.goto("/events/seed-event-001");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 20000 });
    const back = page.getByRole("link", { name: /back to events/i });
    await expect(back).toBeVisible();
    await back.click();
    await expect(page).toHaveURL(/\/events$/);
  });
});

test.describe("events price filter", () => {
  test("clicking the track moves the nearer endpoint", async ({ page }) => {
    await page.goto("/events?view=list");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /^Price$/ }).click();
    const panel = page.locator("[data-filter-panel]");
    const track = panel.locator(".relative.h-4");
    const box = await track.boundingBox();
    expect(box).not.toBeNull();
    // Click at 60% of the track — the max thumb snaps there.
    await page.mouse.click(box!.x + box!.width * 0.6, box!.y + box!.height / 2);
    await expect(panel.getByText(/^\$0 – \$\d+/)).toHaveText(/\$0 – \$1\d{2}/);
  });

  test("re-clicking the active Price pill clears the filter", async ({ page }) => {
    await page.goto("/events?view=list");
    await page.waitForLoadState("networkidle");
    const pricePill = page.getByRole("button", { name: /^Price$/ });
    await pricePill.click();
    // Set a range by moving the max thumb (drag from its default position)
    const maxThumb = page.locator('input[type="range"]').nth(1);
    await maxThumb.focus();
    await maxThumb.press("ArrowLeft");
    const priceChip = page.getByRole("button", { name: /^\$\d+ – \$\d+/ });
    await expect(priceChip).toBeVisible();
    // Dismiss the dropdown; the filter stays active.
    await page.keyboard.press("Escape");
    await expect(priceChip).toBeVisible();
    // Re-clicking the active pill removes the filter.
    await pricePill.click();
    await expect(priceChip).not.toBeVisible();
    await expect(page.getByRole("button", { name: /clear all/i })).not.toBeVisible();
  });
});

test.describe("static pages", () => {
  test("contact page renders", async ({ page }) => {
    await page.goto("/contact");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("contact page visual snapshot", async ({ page }) => {
    await page.goto("/contact");
    await page.waitForLoadState("networkidle");
    await argosScreenshot(page, "contact-page");
  });
});
