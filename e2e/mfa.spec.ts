import { test, expect } from "@playwright/test";
import { goToHomepage } from "./helpers";

test.describe("MFA sign-in flow", () => {
  test("admin login page renders form elements", async ({ page }) => {
    await page.goto("/admin/login");
    await page.waitForLoadState("networkidle");
    await expect(page.getByPlaceholder(/admin@startlineau/i)).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("security settings redirect for unauthenticated users", async ({ page }) => {
    await page.goto("/settings/security");
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/\/settings\/security/);
  });
});
