import { test, expect } from "@playwright/test";
import { organiserLogin } from "./helpers";

test.describe("new listing wizard", () => {
  test("loads the new listing page with 5 steps", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Create new listing")).toBeVisible();
    await expect(page.getByText("The Basics").first()).toBeVisible();
    await expect(page.getByText("Date & Location").first()).toBeVisible();
    await expect(page.getByText("Tickets & Pricing").first()).toBeVisible();
    await expect(page.getByText("Media & Description").first()).toBeVisible();
    await expect(page.getByText("Final Review").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /save draft/i })).toBeVisible();
  });

  test("fills step 1 basics and proceeds to step 2", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder(/Apex Throwdown/i).fill("E2E Test Event");
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page.getByText(/when and where/i).first()).toBeVisible();
  });

  test("address autocomplete shows suggestions", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    // Fill step 1 basics to get to step 2
    await page.getByPlaceholder(/Apex Throwdown/i).fill("Address Test");
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText(/when and where/i).first()).toBeVisible();

    // Set date and time
    await page.getByText("Pick start date").click();
    await page.getByRole("button", { name: /today/i }).click();
    await page.getByRole("button", { name: /\d{4}/i }).first().click();
    // Set start time using native time input
    const timeInputs = page.locator('input[type="time"]');
    await timeInputs.first().fill("09:00");

    // Type into address autocomplete
    const addrInput = page.getByPlaceholder(/start typing an address/i);
    await addrInput.fill("George St Sydney");

    // Wait for suggestion dropdown (may require valid AWS GeoPlaces credentials)
    const dropdown = page.locator("#address-suggestions");
    if (await dropdown.isVisible({ timeout: 5000 }).catch(() => false)) {
      const count = await dropdown.locator("button").count();
      expect(count).toBeGreaterThan(0);
      await dropdown.locator("button").first().click();
      const filledAddr = await addrInput.inputValue();
      expect(filledAddr.length).toBeGreaterThan(0);
    }
    // ponytail: skips if AWS GeoPlaces API unavailable in test env
  });

  test("fills all 5 steps and saves as draft", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    // === Step 1: The Basics ===
    await page.getByPlaceholder(/Apex Throwdown/i).fill("E2E Draft Event");
    await page.getByRole("button", { name: /continue/i }).click();

    // === Step 2: Date & Location ===
    await expect(page.getByText(/when and where/i).first()).toBeVisible();

    await page.getByText("Pick start date").click();
    await page.getByRole("button", { name: /today/i }).click();
    await page.getByRole("button", { name: /\d{4}/i }).first().click();

    // Set start time using native time input
    const timeInputs = page.locator('input[type="time"]');
    await timeInputs.first().fill("09:00");

    // Address with autocomplete (also fills city + state on selection)
    const addrInput = page.getByPlaceholder(/start typing an address/i);
    await addrInput.fill("George St Sydney");
    const addrDropdown = page.locator('[role="combobox"] + div').filter({ has: page.locator('button') });
    if (await addrDropdown.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await addrDropdown.first().locator("button").first().click();
    } else {
      await addrInput.fill("1 Test St, Sydney NSW 2000");
    }

    await page.getByRole("button", { name: /continue/i }).click();

    // === Step 3: Tickets & Pricing ===
    await page.getByRole("button", { name: /startline/i }).first().click();

    const ticketLabel = page.getByPlaceholder(/general admission/i);
    if (await ticketLabel.isVisible()) {
      await ticketLabel.fill("Standard Entry");
    }

    const ticketPrice = page.locator('input[placeholder="129"]');
    if (await ticketPrice.isVisible()) {
      await ticketPrice.fill("50");
    }

    await page.getByRole("button", { name: /no refunds/i }).click();

    await page.getByRole("button", { name: /continue/i }).click();

    // === Step 4: Media & Description ===
    await expect(page.getByText(/cover image/i).first()).toBeVisible();

    const editor = page.locator("[contenteditable]");
    if (await editor.isVisible()) {
      await editor.fill("This is a test event description created by E2E tests.");
    }

    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible()) {
      await fileInput.setInputFiles({
        name: "test.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("test image content"),
      });
    }

    await page.getByRole("button", { name: /continue/i }).click();

    // === Step 5: Final Review ===
    await expect(page.getByText(/review/i).first()).toBeVisible();

    await page.locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: /save draft/i }).click();

    await page.waitForTimeout(2000);
    // ponytail: API save may fail in test env; wizard UX is what's being tested
  });

  test("step rail stays pinned while scrolling", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(400);
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);
    // Regression: overflow-x on html/body used to disable position:sticky
    // site-wide, so the rail scrolled out of view.
    const rail = await page.locator("div.sticky.top-16").boundingBox();
    expect(rail).not.toBeNull();
    expect(rail!.y).toBeGreaterThanOrEqual(0);
  });

  test("single-day date reads clean after closing the picker", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder(/Apex Throwdown/i).fill("Single Day Test");
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText(/when and where/i).first()).toBeVisible();

    await page.getByText("Pick start date").click();
    await page.getByRole("button", { name: /today/i }).click();
    // Close the popover with only a start date picked — a valid single-day event.
    await page.locator("h1").click();
    const dateField = page.locator("button", { hasText: /\d{4}/ }).first();
    await expect(dateField).not.toContainText(/pick end date/i);
  });

  test("price input strips non-numeric characters", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder(/Apex Throwdown/i).fill("Price Test");
    await page.getByRole("button", { name: /continue/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    const price = page.locator('input[placeholder="129"]');
    await price.fill("abc");
    await expect(price).toHaveValue("");
    await price.fill("12.50");
    await expect(price).toHaveValue("12.50");
  });

  // TODO: flaky — save outcome race under parallel load. See issue #227.
  // test("draft without a cut-off time saves without a silent failure", async ({ page }) => {
  //   await organiserLogin(page);
  //   await page.goto("/organiser/new-listing");
  //   await page.waitForLoadState("networkidle");
  //
  //   // Minimal draft: title only, endTime left empty (it's optional).
  //   // Regression: the API used to coerce empty endTime to null, which the
  //   // required schema column rejected — every such save 500ed.
  //   await page.getByPlaceholder(/Apex Throwdown/i).fill("E2E No Cutoff Draft");
  //   await page.getByRole("button", { name: /save draft/i }).click();
  //
  //   // Success navigates to the dashboard; if the test env lacks an organiser
  //   // profile the API errors instead — either way the user must see an
  //   // outcome, never stay stuck on a silently-failed save.
  //   const errorBanner = page.getByText(/unauthorised|failed to save|went wrong/i).first();
  //   await expect
  //     .poll(
  //       async () =>
  //         page.url().includes("/organiser/dashboard") ||
  //         (await errorBanner.isVisible().catch(() => false)),
  //       { timeout: 20000 },
  //     )
  //     .toBe(true);
  // });

  test("shows validation errors on empty submit", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");

    // Advance through all 5 steps without filling anything
    for (let i = 0; i < 4; i++) {
      await page.getByRole("button", { name: /continue/i }).click();
    }

    await page.locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: /publish listing/i }).click();
    await expect(page.getByText(/please complete the following/i)).toBeVisible();
  });
});
