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

  test("shows organiser reviews section when reviews exist", async ({ page }) => {
    await page.goto("/events/seed-event-001");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /^Reviews$/i })).toBeVisible();
    await expect(page.getByText(/Apex Endurance Events/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /view all on organiser profile/i })).toBeVisible();
  });

  test("event card shows organiser name and rating", async ({ page }) => {
    await page.goto("/events?view=list");
    await page.waitForLoadState("networkidle");
    const organiserLink = page.getByRole("button", { name: /Apex Endurance Events/i }).first();
    await expect(organiserLink).toBeVisible();
    // Star rating chip is only rendered when the organiser has published reviews
    await expect(page.getByLabel(/Rated .+ out of 5 from \d+ reviews/i).first()).toBeVisible();
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
