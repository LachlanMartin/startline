import { test, expect } from "@playwright/test";
import { argosScreenshot } from "@argos-ci/playwright";
import { organiserLogin } from "./helpers";



test.describe("organiser login", () => {
  test("signs in via modal and redirects to dashboard", async ({ page }) => {

    await organiserLogin(page);

    await expect(page.locator("h1")).toContainText("Hi there");
  });

  test("landing page renders without sign-in form", async ({ page }) => {
    await page.goto("/organiser");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /organiser/i })).toBeVisible();
    await expect(page.getByText(/sign up for a free user account/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /get started/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /go to dashboard/i })).toBeVisible();
  });
});

test.describe("new listing wizard", () => {
  test("new listing step 1 visual snapshot", async ({ page }) => {

    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");
    await argosScreenshot(page, "new-listing-step1");
  });

  test("new listing step 2 visual snapshot", async ({ page }) => {

    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");
    await page.getByPlaceholder(/Apex Throwdown/i).fill("E2E Visual Test Event");
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForTimeout(500);
    await argosScreenshot(page, "new-listing-step2");
  });

  test("new listing step 3 visual snapshot", async ({ page }) => {

    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");
    await page.getByPlaceholder(/Apex Throwdown/i).fill("E2E Visual Test Event");
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForTimeout(500);
    await page.getByText("Pick start date").click();
    await page.getByRole("button", { name: /today/i }).click();
    await page.getByRole("button", { name: /\d{4}/i }).first().click();
    const timeInputs3 = page.locator('input[type="time"]');
    await timeInputs3.first().fill("09:00");
    const addrInput3 = page.getByPlaceholder(/start typing an address/i);
    await addrInput3.fill("1 Test St, Sydney NSW 2000");
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForTimeout(500);
    await argosScreenshot(page, "new-listing-step3");
  });

  test("new listing step 4 visual snapshot", async ({ page }) => {

    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");
    await page.getByPlaceholder(/Apex Throwdown/i).fill("E2E Visual Test Event");
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForTimeout(500);
    await page.getByText("Pick start date").click();
    await page.getByRole("button", { name: /today/i }).click();
    await page.getByRole("button", { name: /\d{4}/i }).first().click();
    const timeInputs4 = page.locator('input[type="time"]');
    await timeInputs4.first().fill("09:00");
    const addrInput4 = page.getByPlaceholder(/start typing an address/i);
    await addrInput4.fill("1 Test St, Sydney NSW 2000");
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /startline/i }).first().click();
    const price4 = page.locator('input[placeholder="129"]');
    if (await price4.isVisible()) await price4.fill("50");
    await page.getByRole("button", { name: /no refunds/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForTimeout(500);
    await argosScreenshot(page, "new-listing-step4");
  });

  test("new listing final review visual snapshot", async ({ page }) => {

    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder(/Apex Throwdown/i).fill("E2E Visual Test Event");
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForTimeout(500);

    await page.getByText("Pick start date").click();
    await page.getByRole("button", { name: /today/i }).click();
    await page.getByRole("button", { name: /\d{4}/i }).first().click();
    const timeInputs = page.locator('input[type="time"]');
    await timeInputs.first().fill("09:00");
    const addrInput = page.getByPlaceholder(/start typing an address/i);
    await addrInput.fill("1 Test St, Sydney NSW 2000");
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: /startline/i }).first().click();
    const price = page.locator('input[placeholder="129"]');
    if (await price.isVisible()) await price.fill("50");
    await page.getByRole("button", { name: /no refunds/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForTimeout(500);

    await argosScreenshot(page, "new-listing-review");
  });

  test("location preview map shows empty state before address is selected", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder(/Apex Throwdown/i).fill("Map Preview Test Event");
    await page.getByRole("button", { name: /^continue$/i }).click();

    await expect(page.getByText(/when and where/i)).toBeVisible();
    await expect(page.getByTestId("location-preview-empty")).toBeVisible();
    await expect(page.getByText(/select an address above to preview the location/i)).toBeVisible();
  });
});

test.describe("organiser dashboard", () => {
  test("dashboard visual snapshot", async ({ page }) => {

    await organiserLogin(page);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await argosScreenshot(page, "organiser-dashboard");
  });

  test("dashboard shows stats and events after login", async ({ page }) => {

    await organiserLogin(page);

    await expect(page.locator("h1")).toContainText("Hi there");
    await expect(page.getByText("Live now")).toBeVisible();
    await expect(page.getByText("Registrations")).toBeVisible();
    await expect(page.getByText("Total events")).toBeVisible();
    await expect(page.getByText("Your upcoming events")).toBeVisible();
  });

  test("dashboard has view my events button", async ({ page }) => {

    await organiserLogin(page);

    await expect(page.getByRole("link", { name: /view my events/i })).toBeVisible();
  });
});

test.describe("organiser pages", () => {
  test("organiser landing page visual snapshot", async ({ page }) => {
    await page.goto("/organiser");
    await page.waitForLoadState("networkidle");
    await argosScreenshot(page, "organiser-landing");
  });

  test("organiser listings page visual snapshot", async ({ page }) => {

    await organiserLogin(page);
    await page.goto("/organiser/listings");
    await page.waitForLoadState("networkidle");
    await argosScreenshot(page, "organiser-listings");
  });

  test("organiser event dashboard visual snapshot", async ({ page }) => {

    await organiserLogin(page);
    await page.goto("/organiser/events/seed-event-001/dashboard");
    await page.waitForLoadState("networkidle");
    await argosScreenshot(page, "organiser-event-dashboard");
  });

  test("organiser payments page visual snapshot", async ({ page }) => {

    await organiserLogin(page);
    await page.goto("/organiser/payments");
    await page.waitForLoadState("networkidle");
    await argosScreenshot(page, "organiser-payments");
  });

  test("organiser how it works page visual snapshot", async ({ page }) => {

    await organiserLogin(page);
    await page.goto("/organiser/how-it-works");
    await page.waitForLoadState("networkidle");
    await argosScreenshot(page, "organiser-how-it-works");
  });

  test("organiser profile page visual snapshot", async ({ page }) => {

    await organiserLogin(page);
    await page.goto("/organiser/profile");
    await page.waitForLoadState("networkidle");
    await argosScreenshot(page, "organiser-profile");
  });
});
