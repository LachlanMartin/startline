import { test, expect } from "@playwright/test";
import { argosScreenshot } from "@argos-ci/playwright";
import { organiserLogin, pickTime, expectOrganiserDashboard } from "./helpers";

test.describe("organiser setup", () => {
  test("requires contact details when creating a profile", async ({ page }) => {
    // 'user' bypass maps to a seeded authenticated account.
    await page.context().addCookies([
      { name: "__e2e_bypass", value: "user", domain: "localhost", path: "/", sameSite: "Lax" },
    ]);
    await page.goto("/organiser-setup");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /continue/i }).click();

    // Org name alone is no longer enough — contact details are required.
    await page.getByPlaceholder(/Apex Endurance/i).fill("E2E Setup Org");
    await page.getByRole("button", { name: /create organiser profile/i }).click();
    await expect(page.getByText(/please enter a contact name/i)).toBeVisible();

    // Filling the contact fields lets the form submit.
    await page.getByPlaceholder(/full name/i).fill("E2E Contact");
    await page.getByPlaceholder(/events@yourorg/i).fill("e2e@example.com");
    await page.getByPlaceholder(/\+61/i).fill("0412000000");
    await page.getByRole("button", { name: /create organiser profile/i }).click();
    await expect(page).toHaveURL(/\/organiser\/dashboard/, { timeout: 15000 });
  });

  test("setup API rejects missing contact details", async ({ request }) => {
    const res = await request.post("/api/organiser/setup", {
      headers: { Cookie: "__e2e_bypass=user" },
      data: { orgName: "X" },
    });
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/contact details are required/i);
  });
});



test.describe("organiser login", () => {
  test("signs in via modal and redirects to dashboard", async ({ page }) => {

    await organiserLogin(page);

    await expectOrganiserDashboard(page);
  });

  // Owners and managers never reach this page — getOrganiserSession resolves and
  // the page redirects them to the dashboard. So it renders only for someone the
  // portal doesn't recognise, and its two exits are sign-up and sign-in. The old
  // "Go to Dashboard" link was unreachable for the people it was for, and
  // clicking it bounced off middleware straight back here (issue #302).
  test("landing page offers sign-up and sign-in to an unrecognised visitor", async ({ page }) => {
    await page.goto("/organiser");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /organiser/i })).toBeVisible();
    await expect(page.getByText(/sign up for a free user account/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /get started/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
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
    await pickTime(page, "Start time", { hour: "9", minute: "00", period: "AM" });
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
    await pickTime(page, "Start time", { hour: "9", minute: "00", period: "AM" });
    const addrInput4 = page.getByPlaceholder(/start typing an address/i);
    await addrInput4.fill("1 Test St, Sydney NSW 2000");
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /startline/i }).first().click();
    const price4 = page.locator('input[placeholder="129"]');
    if (await price4.isVisible()) await price4.fill("50");
    await page.getByRole("button", { name: /no refunds/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();
    // Step 4 only renders after the tickets step settles — wait on the UI
    // state instead of a fixed timeout so the screenshot is never of a
    // half-transitioned wizard.
    await expect(page.getByText(/cover image/i).first()).toBeVisible({ timeout: 15000 });
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
    await pickTime(page, "Start time", { hour: "9", minute: "00", period: "AM" });
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

    await expectOrganiserDashboard(page);
    await expect(page.getByText("Followers")).toBeVisible();
    await expect(page.getByText("Revenue (est.)")).toBeVisible();
    await expect(page.getByText(/Trend/i).first()).toBeVisible();
    await expect(page.getByLabel("Time range")).toBeVisible();
    await expect(page.getByLabel("Event")).toBeVisible();
    await expect(page.getByLabel("Metric")).toBeVisible();

    await page.getByLabel("Metric").click();
    await page.getByRole("option", { name: "Followers" }).click();
    await expect(page.getByText("New followers")).toBeVisible();
    await expect(page.getByLabel("Event")).toHaveCount(0);

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

  test("ticket tiers show fill progress per tier", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/events/seed-event-001/dashboard");

    await expect(page.getByText("Ticket tiers")).toBeVisible();
    await expect(page.getByText("Sold / Cap").first()).toBeVisible();

    // All three seeded tiers have caps, so each renders a fill gauge.
    const bars = page.getByRole("progressbar");
    await expect(bars).toHaveCount(3);
    // Sold count is bound to the right tier cap, without pinning the exact count.
    await expect(page.getByRole("progressbar", { name: /^Early Bird: \d+ of 80 sold$/ })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: /^General: \d+ of 150 sold$/ })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: /^Late Entry: \d+ of 90 sold$/ })).toBeVisible();
  });

  test("announcement editor applies bold formatting to new text", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/events/seed-event-001/dashboard?panel=announce");

    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible();
    await editor.click();
    await page.getByRole("button", { name: /bold/i }).click();
    await editor.pressSequentially("Hello bold");

    expect(await editor.innerHTML()).toMatch(/<(b|strong)[\s>]/i);
  });

  test("profile settings reposition Done saves and confirms", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/profile");

    await page.getByRole("button", { name: "Edit Profile" }).click();
    await expect(page.getByText("Cover photo")).toBeVisible();

    // The cover has an image in seed data, so Reposition is available.
    await page.getByRole("button", { name: "Reposition" }).first().click();
    await page.getByRole("button", { name: "Done" }).first().click();

    // Done now commits the change rather than silently dropping it.
    await expect(page.getByText("Saved")).toBeVisible();
  });

  test("organiser payments page visual snapshot", async ({ page }) => {

    await organiserLogin(page);
    await page.goto("/organiser/payments");
    await page.waitForLoadState("networkidle");
    await argosScreenshot(page, "organiser-payments");
  });

  test("top nav distinguishes Organisation from My profile", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await organiserLogin(page);
    const orgNav = page.locator("nav").getByRole("link", { name: "Organisation", exact: true });
    await expect(orgNav).toBeVisible();
    await Promise.all([
      page.waitForURL(/\/organiser\/profile/),
      orgNav.click(),
    ]);
  });

  test("payments page shows ABN field for Stripe connection", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/payments");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByText(/ABN or ACN/i).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByPlaceholder("12 345 678 901")).toBeVisible();
  });

  test("new listing media step supports multiple info PDFs with labels, reorder and remove", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Media & Description/i }).click();
    await expect(page.getByText(/event information pdfs/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/add pdfs/i)).toBeVisible();

    const pdfInput = page.locator('input[type="file"][accept="application/pdf"]');
    await pdfInput.setInputFiles([
      { name: "course-map.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 course map") },
      { name: "rules.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 rules") },
    ]);

    await expect(page.getByText(/course-map\.pdf/i)).toBeVisible();
    await expect(page.getByText(/rules\.pdf/i)).toBeVisible();

    await page.getByPlaceholder(/label \(e\.g\. course map\)/i).nth(0).fill("Course Map");
    await expect(page.getByRole("button", { name: "Remove PDF" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Move up" }).first()).toBeDisabled();
    await page.getByRole("button", { name: "Move down" }).first().click();

    await page.getByRole("button", { name: "Remove PDF" }).nth(1).click();
    await expect(page.getByText(/course-map\.pdf/i)).not.toBeVisible();
    await expect(page.getByText(/rules\.pdf/i)).toBeVisible();
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
