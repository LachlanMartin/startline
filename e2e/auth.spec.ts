import { test, expect } from "@playwright/test";
import { argosScreenshot } from "@argos-ci/playwright";
import { goToHomepage } from "./helpers";

const hasCognito = !!process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;

async function openSignInModal(page: import("@playwright/test").Page) {
  await goToHomepage(page);
  await page.getByRole("button", { name: "SIGN IN" }).click();
  await page.waitForSelector('[role="dialog"]');
}

test.describe("auth modal — sign in", () => {
  test("sign-in modal visual snapshot", async ({ page }) => {
    await openSignInModal(page);
    await page.waitForLoadState("networkidle");
    await argosScreenshot(page, "sign-in-modal");
  });

  test("unknown email never dead-ends: 'no account found' or password fallback", async ({ page }) => {
    if (!hasCognito) test.skip();
    await openSignInModal(page);
    await page.getByPlaceholder("you@example.com").fill(`nobody.${Date.now()}@example.com`);
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    // Two valid outcomes: with Cognito admin perms the exists-check says
    // "no account found"; without them the modal falls back to the password
    // step and signIn() itself reports the truth. Either way, never a dead end.
    const noAccount = page.getByRole("heading", { name: "No account found." });
    const passwordStep = page.locator("#signin-password");
    await expect(noAccount.or(passwordStep)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: "Use a different email" })).toBeVisible();

    if (await passwordStep.isVisible()) {
      // Fallback path: a wrong password must produce a truthful Cognito error.
      await passwordStep.fill("WrongPass999!");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(
        page.getByText(/incorrect email or password|no account found with that email/i)
      ).toBeVisible({ timeout: 15000 });
    }
  });

  test("Email label is associated with its input (a11y)", async ({ page }) => {
    await openSignInModal(page);
    await page.getByText("Email", { exact: true }).click();
    const focused = await page.evaluate(() => document.activeElement?.id);
    expect(focused).toBe("signin-email");
  });
});

test.describe("auth modal — sign up", () => {
  test("rejects mismatched passwords before hitting the network", async ({ page }) => {
    await openSignInModal(page);
    await page.getByRole("button", { name: "Create Account", exact: true }).click();
    await page.getByPlaceholder("you@example.com").fill(`ux.${Date.now()}@example.com`);
    await page.getByPlaceholder("Min 8 characters").fill("Password123!");
    await page.getByPlaceholder("Re-enter password").fill("Different123!");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page.getByText("Passwords do not match.")).toBeVisible();
  });

  test("rejects a too-short password", async ({ page }) => {
    await openSignInModal(page);
    await page.getByRole("button", { name: "Create Account", exact: true }).click();
    await page.getByPlaceholder("you@example.com").fill(`ux.${Date.now()}@example.com`);
    await page.getByPlaceholder("Min 8 characters").fill("abc123");
    await page.getByPlaceholder("Re-enter password").fill("abc123");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page.getByText("Password must be at least 8 characters.")).toBeVisible();
  });

  test("onboarding rejects an under-13 date of birth", async ({ page }) => {
    await openSignInModal(page);
    await page.getByRole("button", { name: "Create Account", exact: true }).click();
    await page.getByPlaceholder("you@example.com").fill(`ux.${Date.now()}@example.com`);
    await page.getByPlaceholder("Min 8 characters").fill("Password123!");
    await page.getByPlaceholder("Re-enter password").fill("Password123!");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await page.waitForSelector("text=Tell us a bit about yourself");

    await page.getByPlaceholder("First").fill("Too");
    await page.getByPlaceholder("Last").fill("Young");
    const today = new Date();
    await page.locator('input[aria-label="Day"]').fill(String(today.getDate()).padStart(2, "0"));
    await page.locator('input[aria-label="Month"]').fill(String(today.getMonth() + 1).padStart(2, "0"));
    await page.locator('input[aria-label="Year"]').fill(String(today.getFullYear() - 5));
    await page.locator('input[type="checkbox"]').check({ force: true });
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await expect(page.getByText("You must be at least 13 years old to create an account.")).toBeVisible();
  });

  test("completing signup lands on the verify-email page, not a 404", async ({ page }) => {
    if (!hasCognito) test.skip();
    const email = `ux.e2e.${Date.now()}@example.com`;

    await openSignInModal(page);
    await page.getByRole("button", { name: "Create Account", exact: true }).click();
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("Min 8 characters").fill("Password123!");
    await page.getByPlaceholder("Re-enter password").fill("Password123!");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await page.waitForSelector("text=Tell us a bit about yourself");

    await page.getByPlaceholder("First").fill("Ux");
    await page.getByPlaceholder("Last").fill("Tester");
    await page.locator('input[aria-label="Day"]').fill("15");
    await page.locator('input[aria-label="Month"]').fill("06");
    await page.locator('input[aria-label="Year"]').fill("1995");
    await page.locator('input[type="checkbox"]').check({ force: true });
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    // signUp() hits real Cognito — give it real network time
    await page.waitForSelector("text=Choose your", { timeout: 20000 });
    await page.getByRole("button", { name: "Skip for now" }).click();

    await page.waitForURL("**/auth/verify-email**", { timeout: 20000 });
    await expect(page).not.toHaveURL(/\/customer\//);
    await expect(page.getByText("This page could not be found.")).not.toBeVisible();
    await expect(page.getByRole("heading", { name: /6-digit code/i })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    // A wrong code must show an error and NOT redirect/auto-sign-in.
    // (The auto-sign-in success path itself can't be exercised here — Cognito
    // emails a real 6-digit code to an inbox this suite has no access to.
    // Verify that path manually with a real mailbox after touching this flow.)
    await page.locator("#verify-code-input").fill("000000");
    await page.getByRole("button", { name: /verify & sign in/i }).click();
    await expect(page.getByText(/verification failed|code is incorrect/i)).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/auth\/verify-email/);
  });
});

test.describe("forgot-password route", () => {
  test("/auth/forgot-password renders (not a 404)", async ({ page }) => {
    await page.goto("/auth/forgot-password");
    await expect(page.getByText("This page could not be found.")).not.toBeVisible();
    await expect(page.getByRole("button", { name: /send reset code/i })).toBeVisible();
  });

  test("forgot-password page visual snapshot", async ({ page }) => {
    await page.goto("/auth/forgot-password");
    await page.waitForLoadState("networkidle");
    await argosScreenshot(page, "forgot-password");
  });
});
