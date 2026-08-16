import { test, expect } from "@playwright/test";

test.describe("contact page", () => {
  test("renders contact form", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByRole("heading", { name: /Send us a/i })).toBeVisible();
    await expect(page.getByLabel(/^Name/i)).toBeVisible();
    await expect(page.getByLabel(/^Email/i)).toBeVisible();
    await expect(page.getByLabel(/^Subject/i)).toBeVisible();
    await expect(page.getByLabel(/^Message/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Send Message/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "admin@startlineau.com" })).toBeVisible();
  });

  test("submits message and shows confirmation", async ({ page }) => {
    await page.route("**/api/contact", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/contact");
    await page.getByLabel(/^Name/i).fill("Jade Nguyen");
    await page.getByLabel(/^Email/i).fill("jade.nguyen@startline.test");
    await page.getByLabel(/^Subject/i).fill("Question about registration");
    await page.getByLabel(/^Message/i).fill("How do I update my emergency contact details?");
    await page.getByRole("button", { name: /Send Message/i }).click();

    await expect(page.getByRole("heading", { name: /Message/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Back to the Startline/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Send Another/i })).toHaveCount(0);
    await expect(page.getByText(/Message Summary/i)).toBeVisible();
    await expect(page.getByText("Jade Nguyen")).toBeVisible();
    await expect(page.locator("strong", { hasText: "jade.nguyen@startline.test" })).toBeVisible();
    await expect(page.getByText("Question about registration")).toBeVisible();
  });


  test("shows API error message", async ({ page }) => {
    await page.route("**/api/contact", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Email service is not configured yet. Please try again shortly.",
        }),
      });
    });

    await page.goto("/contact");
    await page.getByLabel(/^Name/i).fill("Jade Nguyen");
    await page.getByLabel(/^Email/i).fill("jade.nguyen@startline.test");
    await page.getByLabel(/^Subject/i).fill("Help");
    await page.getByLabel(/^Message/i).fill("Need support with my account.");
    await page.getByRole("button", { name: /Send Message/i }).click();

    await expect(
      page.getByRole("alert").filter({
        hasText: "Email service is not configured yet. Please try again shortly.",
      }),
    ).toBeVisible();
  });
});
