import { test, expect } from "@playwright/test";
import { organiserLogin, organiserMemberLogin } from "./helpers";

test.describe("organiser members", () => {
  test("owner sees members page with both members", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/members");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /members/i })).toBeVisible();
    await expect(page.getByText("sarah.mitchell@startline.test")).toBeVisible();
    await expect(page.getByText("Owner", { exact: true })).toBeVisible();
    await expect(page.getByText("tom.whitfield@startline.test")).toBeVisible();
    await expect(page.getByText("Manager", { exact: true }).first()).toBeVisible();
  });

  test("owner can add a member by email", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/members");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder("team@email.com").fill("jade.nguyen@startline.test");
    await page.getByRole("button", { name: /add member/i }).click();

    await expect(page.getByText("jade.nguyen@startline.test")).toBeVisible();
  });

  test("owner cannot add a non-existent account", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/members");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder("team@email.com").fill("nobody@nowhere.test");
    await page.getByRole("button", { name: /add member/i }).click();

    await expect(page.getByText(/no account found/i)).toBeVisible();
  });

  test("member (manager) can view the roster but not manage it", async ({ page }) => {
    await organiserMemberLogin(page);
    await page.goto("/organiser/members");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /members/i })).toBeVisible();
    await expect(page.getByText("sarah.mitchell@startline.test")).toBeVisible();
    await expect(page.getByPlaceholder("team@email.com")).not.toBeVisible();
    await expect(page.getByRole("button", { name: /transfer ownership/i })).not.toBeVisible();
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
