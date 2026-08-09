import { test, expect } from "@playwright/test";
import { argosScreenshot } from "@argos-ci/playwright";

// The registration flow is a 3-step design: Select ticket → Your details →
// Review & pay, with a sticky order-summary sidebar. Step 1 uses per-tier
// quantity steppers (mixed-tier orders allowed); step 2 shows one form per
// ticket, as an accordion when there is more than one ticket.
// seed-event-001 has an open tier (Late Entry) plus closed tiers (Early Bird,
// General) relative to the test clock.
const REG = "/events/seed-event-001/register";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Click the first open tier's "+" stepper `count` times. */
async function addTickets(page: import("@playwright/test").Page, count = 1) {
  const plus = page.getByRole("button", { name: /add one .* ticket/i }).first();
  for (let i = 0; i < count; i++) await plus.click();
}

/**
 * Date of birth uses the themed DatePicker popover (no native date input), so
 * drive it the way an athlete does: year grid → month arrows → day.
 */
async function pickDateOfBirth(page: import("@playwright/test").Page, iso: string, field = "#p0-dob") {
  const [year, month, day] = iso.split("-").map(Number);
  await page.locator(field).click();

  const header = page.getByRole("button", { name: new RegExp(`^(${MONTHS.join("|")}) \\d{4}$`) });
  await header.click();
  await page.getByRole("button", { name: String(year), exact: true }).click();

  for (let i = 0; i < 12; i++) {
    const text = await header.textContent();
    const viewMonth = MONTHS.findIndex(m => text?.startsWith(m));
    if (viewMonth === month - 1) break;
    await page.getByRole("button", { name: viewMonth > month - 1 ? "Previous month" : "Next month" }).click();
  }

  await page.getByRole("button", { name: String(day), exact: true }).click();
}

test.describe("registration flow", () => {
  test("shows the 3-step rail and tier selection first", async ({ page }) => {
    await page.goto(REG);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/select ticket/i).first()).toBeVisible();
    await expect(page.getByText(/your details/i).first()).toBeVisible();
    await expect(page.getByText(/review & pay/i).first()).toBeVisible();
    await expect(page.getByText(/choose your tickets/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /secure your/i })).toBeVisible();
  });

  test("shows back to event link", async ({ page }) => {
    await page.goto(REG);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("link", { name: /back to event/i }).first()).toBeVisible();
  });

  test("Continue is disabled until at least one ticket is added", async ({ page }) => {
    await page.goto(REG);
    await page.waitForLoadState("networkidle");

    const cont = page.getByRole("button", { name: /^Continue/ });
    await expect(cont).toBeDisabled();
    await addTickets(page, 1);
    await expect(cont).toBeEnabled();
  });

  test("register page visual snapshot", async ({ page }) => {
    await page.goto("/events/seed-event-001/register");
    await page.waitForLoadState("networkidle");
    await argosScreenshot(page, "register-page");
  });

  test("quantity stepper adds and removes tickets, updating the total", async ({ page }) => {
    await page.goto(REG);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/select a tier to see your total/i)).toBeVisible();
    await addTickets(page, 2);
    await expect(page.getByText(/order summary/i)).toBeVisible();
    await expect(page.getByText(/^total$/i)).toBeVisible();
    await expect(page.getByText(/2 ×/).first()).toBeVisible();

    // Stepping back down to zero clears the summary again.
    const minus = page.getByRole("button", { name: /remove one .* ticket/i }).first();
    await minus.click();
    await minus.click();
    await expect(page.getByText(/select a tier to see your total/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Continue/ })).toBeDisabled();
  });

  test("closed ticket tiers show as closed with no quantity stepper", async ({ page }) => {
    // Regression: closed waves used to be selectable and purchasable.
    await page.goto(REG);
    await page.waitForLoadState("networkidle");

    const earlyBird = page.getByText("Early Bird", { exact: true });
    if (await earlyBird.isVisible().catch(() => false)) {
      await expect(page.getByText(/closed$/i).first()).toBeVisible();
      await expect(page.getByRole("button", { name: /add one early bird ticket/i })).toHaveCount(0);
    }
  });

  test("details step shows Contact / Personal / Safety with gender + medical", async ({ page }) => {
    await page.goto(REG);
    await page.waitForLoadState("networkidle");
    await addTickets(page, 1);
    await page.getByRole("button", { name: /^Continue/ }).click();

    // Contact / Personal / Safety fields (anchored by id to avoid footer collisions).
    await expect(page.locator("#p0-firstName")).toBeVisible();
    await expect(page.locator("#p0-email")).toBeVisible();
    await expect(page.locator("#p0-gender")).toBeVisible();
    await expect(page.locator("#p0-ecName")).toBeVisible();
    await expect(page.locator("#p0-medical")).toBeVisible();
  });

  test("details Continue is gated until required fields are filled", async ({ page }) => {
    await page.goto(REG);
    await page.waitForLoadState("networkidle");
    await addTickets(page, 1);
    await page.getByRole("button", { name: /^Continue/ }).click();

    await expect(page.locator("#p0-firstName")).toBeVisible();
    const cont = page.getByRole("button", { name: /^Continue/ });
    await expect(cont).toBeDisabled();

    await page.locator("#p0-firstName").fill("Jordan");
    await page.locator("#p0-lastName").fill("Clarke");
    await page.locator("#p0-email").fill("jordan@example.com");
    await pickDateOfBirth(page, "1994-03-20");
    await page.locator("#p0-ecName").fill("Sam Clarke");
    await page.locator("#p0-ecPhone").fill("0498 111 222");
    await expect(cont).toBeEnabled();
  });

  test("multi-ticket order shows one accordion form per ticket", async ({ page }) => {
    await page.goto(REG);
    await page.waitForLoadState("networkidle");
    await addTickets(page, 2);
    await page.getByRole("button", { name: /^Continue/ }).click();

    // Each ticket gets a clearly-labelled accordion card; ticket 1 opens first.
    await expect(page.getByText(/ticket 1 of 2/i)).toBeVisible();
    await expect(page.getByText(/ticket 2 of 2/i)).toBeVisible();
    await expect(page.locator("#p0-firstName")).toBeVisible();
    await expect(page.locator("#p1-firstName")).toHaveCount(0);

    // Shared emergency contact is the default for multi-ticket orders.
    await expect(page.getByText(/use one emergency contact for all tickets/i)).toBeVisible();
    await expect(page.locator("#shared-ecName")).toBeVisible();
    await expect(page.locator("#p0-ecName")).toHaveCount(0);

    // Opening ticket 2 collapses ticket 1.
    await page.getByText(/ticket 2 of 2/i).click();
    await expect(page.locator("#p1-firstName")).toBeVisible();
    await expect(page.locator("#p0-firstName")).toHaveCount(0);
  });

  test("opting out of the shared emergency contact shows per-ticket fields", async ({ page }) => {
    await page.goto(REG);
    await page.waitForLoadState("networkidle");
    await addTickets(page, 2);
    await page.getByRole("button", { name: /^Continue/ }).click();

    await expect(page.locator("#shared-ecName")).toBeVisible();
    await page.getByText(/use one emergency contact for all tickets/i).click();
    await expect(page.locator("#shared-ecName")).toHaveCount(0);
    // The open ticket form now carries its own emergency contact fields.
    await expect(page.locator("#p0-ecName")).toBeVisible();
  });

  test("ticket quantity is locked on the details step", async ({ page }) => {
    await page.goto(REG);
    await page.waitForLoadState("networkidle");
    await addTickets(page, 2);
    await page.getByRole("button", { name: /^Continue/ }).click();

    await expect(page.getByText(/ticket 1 of 2/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /add another participant/i })).toHaveCount(0);

    // Going Back preserves the selection for editing.
    await page.getByRole("button", { name: /^Back$/i }).click();
    await expect(page.getByText(/choose your tickets/i)).toBeVisible();
    await expect(page.getByText(/2 ×/).first()).toBeVisible();
  });

  test("the 'Back to event' breadcrumb clears the fixed nav", async ({ page }) => {
    // Regression: the register page lacked top padding for the fixed 56px nav,
    // so the breadcrumb rendered underneath the header on every step.
    await page.goto(REG);
    await page.waitForLoadState("networkidle");

    const nav = await page.locator("nav").first().boundingBox();
    const crumb = await page.getByRole("link", { name: /back to event/i }).first().boundingBox();
    expect(nav).not.toBeNull();
    expect(crumb).not.toBeNull();
    // The breadcrumb's top must sit at or below the nav's bottom edge.
    expect(crumb!.y).toBeGreaterThanOrEqual(nav!.y + nav!.height);
  });

  test("guest email-verify step is never a dead end", async ({ page }) => {
    // Regression: when the auto-send failed, the verify step showed an error
    // with no code input and no Resend — stranding the buyer. The code entry
    // and Resend must be present once a send has been attempted, pass or fail.
    await page.goto(REG);
    await page.waitForLoadState("networkidle");
    await addTickets(page, 1);
    await page.getByRole("button", { name: /^Continue/ }).click();

    await expect(page.locator("#p0-firstName")).toBeVisible();
    await page.locator("#p0-firstName").fill("Jordan");
    await page.locator("#p0-lastName").fill("Clarke");
    // Unique guest email (never the signed-in account) → forces the verify gate.
    await page.locator("#p0-email").fill(`guest-${Date.now()}@example.com`);
    await pickDateOfBirth(page, "1994-03-20");
    await page.locator("#p0-ecName").fill("Sam Clarke");
    await page.locator("#p0-ecPhone").fill("0498 111 222");
    await page.getByRole("button", { name: /^Continue/ }).click();

    // The verify gate should appear with a usable code entry and a Resend path.
    await expect(page.getByText(/verify email addresses/i)).toBeVisible();
    await expect(page.locator('input[inputmode="numeric"]').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /^Resend$/i }).first()).toBeVisible();
  });
});

test.describe("confirmation page", () => {
  test("confirmation page visual snapshot", async ({ page }) => {
    await page.goto("/events/seed-event-001/register/confirmation");
    await page.waitForLoadState("networkidle");
    await argosScreenshot(page, "registration-confirmation");
  });

  test("renders standalone with confirmation message and links", async ({ page }) => {
    await page.goto("/events/seed-event-001/register/confirmation");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/registration/i).first()).toBeVisible();
    await expect(page.getByText(/confirmed/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /back to event/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /browse more events/i })).toBeVisible();
  });
});
