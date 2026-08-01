import { test, expect } from "@playwright/test";
import { organiserLogin, organiserMemberLogin } from "./helpers";

test.describe("organiser members", () => {
  test("super admin sees members page with both members", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/members");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /members/i })).toBeVisible();
    await expect(page.getByText("sarah.mitchell@startline.test")).toBeVisible();
    await expect(page.getByText("Owner")).toBeVisible();
    await expect(page.getByText("tom.whitfield@startline.test")).toBeVisible();
    await expect(page.getByText("Manager").first()).toBeVisible();
  });

  test("super admin can add a member by email", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/members");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder("team@email.com").fill("jade.nguyen@startline.test");
    await page.getByRole("button", { name: /add member/i }).click();

    await expect(page.getByText("jade.nguyen@startline.test")).toBeVisible();
  });

  test("super admin cannot add a non-existent account", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/members");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder("team@email.com").fill("nobody@nowhere.test");
    await page.getByRole("button", { name: /add member/i }).click();

    await expect(page.getByText(/no account found/i)).toBeVisible();
  });

  test("member (admin) is forbidden from the members page", async ({ page }) => {
    await organiserMemberLogin(page);
    await page.goto("/organiser/members");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/do not have access to members/i)).toBeVisible();
    await expect(page.getByPlaceholder("team@email.com")).not.toBeVisible();
  });

  test("member (admin) cannot add members", async ({ page }) => {
    await organiserMemberLogin(page);
    const res = await page.request.post("/api/organiser/members", {
      data: { email: "jade.nguyen@startline.test" },
    });
    expect(res.status()).toBe(403);
  });

  test("member (admin) can still reach the dashboard", async ({ page }) => {
    await organiserMemberLogin(page);
    await expect(page.locator("h1")).toContainText("Hi there");
  });
});
