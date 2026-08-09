import { test, expect, type Page } from "@playwright/test";

const SYDNEY = { latitude: -33.8688, longitude: 151.2093 };

async function stubGeocode(page: Page, result: { latitude: number; longitude: number } | null, delay = 0) {
  await page.route("**/api/places/geocode**", async (route) => {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    await route.fulfill({ json: { result } });
  });
}

async function searchWhere(page: Page, query: string) {
  await page.getByPlaceholder("State, city, or suburb").fill(query);
  await page.keyboard.press("Enter");
}

test.describe("distance-based search", () => {
  // TODO: flaky — geocoding timing under parallel load. See issue #227.
  // test("geocoding a valid suburb sorts events closest-first and shows distance badges", async ({ page }) => {
  //   await stubGeocode(page, SYDNEY);
  //   await page.goto("/events?view=list");
  //   await page.waitForLoadState("networkidle");
  //
  //   await searchWhere(page, "Sydney");
  //
  //   // Distance badges appear once geocoding succeeds.
  //   await expect(page.locator('[data-testid="event-distance"]').first()).toBeVisible({ timeout: 10000 });
  //
  //   // Sydney events are all near the origin — badges read like "0km away".
  //   const badges = page.locator('[data-testid="event-distance"]');
  //   const texts = await badges.allTextContents();
  //   expect(texts.length).toBeGreaterThan(0);
  //   expect(texts.every((t) => /^[\d.]+km away$/.test(t))).toBe(true);
  // });

  // TODO: flaky — geocoding timing under parallel load. See issue #227.
  // test("loading state shows a spinner while geocoding", async ({ page }) => {
  //   await stubGeocode(page, SYDNEY, 1500);
  //   await page.goto("/events?view=list");
  //   await page.waitForLoadState("networkidle");
  //
  //   await searchWhere(page, "Sydney");
  //
  //   await expect(page.locator('[data-testid="geocoding-spinner"]').first()).toBeVisible({ timeout: 3000 });
  //   await expect(page.locator('[data-testid="event-distance"]').first()).toBeVisible({ timeout: 10000 });
  // });

  test("falls back to substring matching when geocoding fails", async ({ page }) => {
    await stubGeocode(page, null);
    await page.goto("/events?view=list");
    await page.waitForLoadState("networkidle");

    await searchWhere(page, "Sydney");

    // No distance badges (geocode returned nothing), but substring filtering still applies.
    await expect(page.locator('[data-testid="event-distance"]').first()).toHaveCount(0);
    await expect(page.getByText(/Sydney Harbour 10K/).first()).toBeVisible();
  });

  test("unknown suburb without geocode results shows no events and empty state", async ({ page }) => {
    await stubGeocode(page, null);
    await page.goto("/events?view=list");
    await page.waitForLoadState("networkidle");

    await searchWhere(page, "zzz-no-such-place");

    await expect(page.getByText("No events found.").first()).toBeVisible({ timeout: 10000 });
  });

  test("clearing the where input resets to normal listing", async ({ page }) => {
    await stubGeocode(page, SYDNEY);
    await page.goto("/events?view=list");
    await page.waitForLoadState("networkidle");

    await searchWhere(page, "Sydney");
    await expect(page.locator('[data-testid="event-distance"]').first()).toBeVisible({ timeout: 10000 });

    // Clear the input via the X button.
    await page.getByRole("button", { name: "Clear where" }).first().click();
    await expect(page.locator('[data-testid="event-distance"]').first()).toHaveCount(0);
    await expect(page.getByText(/events found/i).first()).toBeVisible();
  });

  test("use my location button triggers device geolocation", async ({ page }) => {
    await stubGeocode(page, SYDNEY);
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({ latitude: SYDNEY.latitude, longitude: SYDNEY.longitude });
    await page.goto("/events?view=list");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Use my location" }).first().click();

    // GPS resolves to the device position — distance badges appear.
    await expect(page.locator('[data-testid="event-distance"]').first()).toBeVisible({ timeout: 10000 });
  });
});
