import type { Page } from "@playwright/test";

export async function goToHomepage(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
}

export async function searchEvents(page: Page, query: string): Promise<void> {
  const searchInput = page.getByPlaceholder(/search/i);
  if (await searchInput.isVisible()) {
    await searchInput.fill(query);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
  }
}

export async function selectStateFilter(page: Page, state: string): Promise<void> {
  const button = page.getByRole("button", { name: new RegExp(state, "i") });
  if (await button.isVisible()) {
    await button.click();
    await page.waitForTimeout(300);
  }
}

export async function organiserLogin(page: Page, _email = "sarah.mitchell@startline.test"): Promise<void> {
  await page.context().addCookies([
    { name: "__e2e_bypass", value: "organiser", domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
  await page.goto("/organiser/dashboard");
  await page.waitForURL("**/organiser/dashboard**", { timeout: 15000 });
}

export async function organiserMemberLogin(page: Page): Promise<void> {
  await page.context().addCookies([
    { name: "__e2e_bypass", value: "member", domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
  await page.goto("/organiser/dashboard");
  await page.waitForURL("**/organiser/dashboard**", { timeout: 15000 });
}

export async function adminLogin(page: Page, _email = "marcus.stirling@startline.test"): Promise<void> {
  await page.context().addCookies([
    { name: "__e2e_bypass", value: "admin", domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
  await page.goto("/admin/dashboard");
  await page.waitForURL("**/admin/dashboard**", { timeout: 15000 });
}
