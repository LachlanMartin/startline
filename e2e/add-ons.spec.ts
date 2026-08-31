import { test, expect } from "@playwright/test";

// Paid add-ons: merchandise sold alongside the entry. seed-event-001 carries an
// "Event tee" (S/M/L in stock, XL deliberately seeded at zero) and a
// "Parking pass". Extras are chosen per participant on step 2, because sizes are
// inherently per person, so the picker sits under each ticket's details form.
const REG = "/events/seed-event-001/register";

async function addTickets(page: import("@playwright/test").Page, count = 1) {
  const plus = page.getByRole("button", { name: /add one .* ticket/i }).first();
  for (let i = 0; i < count; i++) await plus.click();
}

async function goToDetails(page: import("@playwright/test").Page, tickets = 1) {
  await page.goto(REG);
  await page.waitForLoadState("networkidle");
  await addTickets(page, tickets);
  await page.getByRole("button", { name: /^Continue/ }).click();
}

test.describe("paid add-ons", () => {
  test("teases the extras on the ticket step, where participants do not exist yet", async ({ page }) => {
    await page.goto(REG);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/extras available/i)).toBeVisible();
    await expect(page.getByText(/Event tee/).first()).toBeVisible();
    await expect(page.getByText(/add them to each ticket on the next step/i)).toBeVisible();
  });

  test("shows the picker under the details form, grouped by its option label", async ({ page }) => {
    await goToDetails(page);

    await expect(page.getByText(/add extras/i)).toBeVisible();
    await expect(page.getByText("Event tee", { exact: true })).toBeVisible();
    await expect(page.getByText(/unisex fit/i)).toBeVisible();
    // The organiser names the option group; it is not hardcoded to "Size".
    await expect(page.getByText("Size", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Day", { exact: true }).first()).toBeVisible();
  });

  test("a size with no stock reads as sold out and cannot be added", async ({ page }) => {
    await goToDetails(page);

    await expect(page.getByRole("button", { name: /add one event tee XL/i })).toHaveCount(0);
    await expect(page.getByText(/sold out/i).first()).toBeVisible();
  });

  test("adding an extra puts a line on the order summary and moves the total", async ({ page }) => {
    await goToDetails(page);

    const totalBefore = await page.getByText(/^\$[\d,.]+$/).last().textContent();

    await page.getByRole("button", { name: /add one event tee M/i }).click();

    // The summary line carries the ticket number, so a group booking cannot
    // collide on duplicate labels.
    await expect(page.getByText(/Ticket 1 · Event tee \(M\) × 1/)).toBeVisible();
    const totalAfter = await page.getByText(/^\$[\d,.]+$/).last().textContent();
    expect(totalAfter).not.toBe(totalBefore);
  });

  test("removing an extra takes its line back off the summary", async ({ page }) => {
    await goToDetails(page);

    await page.getByRole("button", { name: /add one event tee M/i }).click();
    await expect(page.getByText(/Ticket 1 · Event tee \(M\) × 1/)).toBeVisible();

    await page.getByRole("button", { name: /remove one event tee M/i }).click();
    await expect(page.getByText(/Ticket 1 · Event tee \(M\)/)).toHaveCount(0);
  });

  test("each participant in a group booking gets their own extras", async ({ page }) => {
    await goToDetails(page, 2);

    // Ticket 1's accordion is open first.
    await page.getByRole("button", { name: /^Ticket 1 add one event tee M/i }).click();
    await expect(page.getByText(/Ticket 1 · Event tee \(M\) × 1/)).toBeVisible();

    // Open ticket 2 and buy the same shirt for them.
    await page.getByRole("button", { name: /Ticket 2 of 2/i }).click();
    await page.getByRole("button", { name: /^Ticket 2 add one event tee M/i }).click();

    // Two distinct lines, which is exactly what keeps the summary's React keys
    // unique when two people buy the same item.
    await expect(page.getByText(/Ticket 1 · Event tee \(M\) × 1/)).toBeVisible();
    await expect(page.getByText(/Ticket 2 · Event tee \(M\) × 1/)).toBeVisible();
  });

  test("extras survive into the review step", async ({ page }) => {
    await goToDetails(page);

    await page.getByRole("button", { name: /add one parking pass Saturday/i }).click();
    await expect(page.getByText(/Ticket 1 · Parking pass \(Saturday\) × 1/)).toBeVisible();
  });
});
