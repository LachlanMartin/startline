import { expect, type Page } from "@playwright/test";

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

// Avery Quinn — MANAGER of both Apex Endurance Events and Coastal Fitness
// Collective (no OWNER role). The only seeded user whose active organiser is
// decided purely by the startline_active_org cookie (issue #231).
export async function multiOrganiserLogin(page: Page): Promise<void> {
  await page.context().addCookies([
    { name: "__e2e_bypass", value: "avery", domain: "localhost", path: "/", sameSite: "Lax" },
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

// Resets a seeded registration on seed-event-001 back to a known state so
// tests that mutate shared seed rows stay idempotent across runs/retries.
// Uses the organiser API so the bypass cookie covers auth.
export async function resetRegistration(
  page: Page,
  athleteName: string,
  patch: Record<string, string | null>,
): Promise<void> {
  const res = await page.request.get("/api/organiser/events/seed-event-001/registrations");
  expect(res.ok()).toBeTruthy();
  const { registrations } = await res.json();
  const reg = registrations.find((r: { name: string }) => r.name === athleteName);
  expect(reg, `expected a seeded registration for ${athleteName}`).toBeTruthy();
  const patchRes = await page.request.patch("/api/organiser/events/seed-event-001/registrations", {
    data: { registrations: [{ registrationId: reg.id, ...patch }] },
  });
  expect(patchRes.ok()).toBeTruthy();
}

/**
 * Pick a time from the shared TimePicker popover.
 *
 * The wizard used a native `input[type="time"]` that tests drove with .fill().
 * It is now a custom popover (the OS panel ignored the design system), so there
 * is no input to fill: open the trigger, choose from three listboxes, confirm.
 *
 * `name` is the trigger's accessible name, e.g. "Start time".
 */
export async function pickTime(
  page: Page,
  name: string,
  time: { hour: string; minute: string; period: "AM" | "PM" },
): Promise<void> {
  // Close anything already open. The date picker stays open in "pick end date"
  // mode after a start date is chosen, and its calendar overlays this field, so
  // the click would never land. Popover triggers toggle, so clicking the open
  // one shuts it.
  for (const open of await page
    .locator('button[aria-haspopup="dialog"][aria-expanded="true"]')
    .all()) {
    await open.click();
  }

  const trigger = page.getByRole("button", { name, exact: true });
  const panel = page.getByRole("dialog", { name: /choose a time/i });

  await trigger.click();
  await expect(panel).toBeVisible();

  await panel.getByRole("listbox", { name: "Hour" })
    .getByRole("option", { name: time.hour, exact: true }).click();
  await panel.getByRole("listbox", { name: "Minute" })
    .getByRole("option", { name: time.minute, exact: true }).click();
  await panel.getByRole("listbox", { name: "AM or PM" })
    .getByRole("option", { name: time.period, exact: true }).click();

  await panel.getByRole("button", { name: /^done$/i }).click();
  await expect(panel).toBeHidden();
}

/**
 * The organiser dashboard has landed. It used to be asserted with an <h1>
 * greeting that the header tidy-up removed, so anchor on the metric strip and
 * the primary action instead - both are load-bearing UI, not decoration.
 */
export async function expectOrganiserDashboard(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/organiser\/dashboard/);
  await expect(page.getByText("All time", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /add listing/i })).toBeVisible();
}
