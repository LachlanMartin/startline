import { test, expect } from "@playwright/test";

const BYPASS_COOKIE = { name: "__e2e_bypass", value: "1", domain: "localhost", path: "/", sameSite: "Lax" as const };

// Bypass cookie maps server-side to sarah.mitchell@startline.test, which owns
// Apex Endurance Events and follows Coastal Fitness Collective.
const COASTAL_ORG = "Coastal Fitness Collective";

async function coastalOrganiserId(page: import("@playwright/test").Page): Promise<string> {
  const events = await (await page.request.get("/api/events")).json();
  const event = events.find((e: { organizer?: string; organiser?: { orgName?: string } }) =>
    e.organizer === COASTAL_ORG || e.organiser?.orgName === COASTAL_ORG
  );
  expect(event, "expected a Coastal Fitness Collective event in /api/events").toBeTruthy();
  return event.organiserId;
}

test.describe("user profile: race history", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([BYPASS_COOKIE]);
  });

  test("shows KStats and chronological race history from completed registrations", async ({ page }) => {
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    // Bypass user is sarah.mitchell@startline.test — seeded with 2 completed events
    await expect(page.getByText("Events Completed")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Race History" })).toBeVisible();
    await expect(page.getByText("The Apex Throwdown 2025")).toBeVisible();
    await expect(page.getByText("Apex Bay Run")).toBeVisible();

    // Results + times are shown for seeded registrations
    await expect(page.getByText("5th", { exact: true })).toBeVisible();
    await expect(page.getByText("02:01:12", { exact: true })).toBeVisible();
  });

  // TODO: flaky — save/activity refetch race under parallel load. See issue #227.
  // test("saving an event from the listing appears on the activity Saved tab", async ({ page }) => {
  //   await page.goto("/events");
  //   await page.waitForLoadState("networkidle");
  //
  //   // The first matching save button may live in a hidden list container —
  //   // target a visible one instead.
  //   const saveButtons = page.locator('[aria-label="Save event"]:visible');
  //   await expect(saveButtons.first()).toBeVisible();
  //   await saveButtons.first().click();
  //   await expect(page.getByRole("button", { name: /unsave event/i }).first()).toBeVisible();
  //
  //   await page.goto("/activity");
  //   await page.waitForLoadState("networkidle");
  //
  //   await page.getByRole("button", { name: /saved/i }).click();
  //   await expect(page.getByText("Saved", { exact: false }).first()).toBeVisible();
  // });

  test("Following tab lists followed organisers and can unfollow", async ({ page }) => {
    // Re-follow Coastal so the test is deterministic even if a prior run
    // unfollowed it (the DELETE persists in the DB).
    const coastalId = await coastalOrganiserId(page);
    await page.request.post(`/api/public/organisers/${coastalId}/follow`);

    await page.goto("/activity");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /following/i }).click();
    await expect(page.getByText(COASTAL_ORG)).toBeVisible();

    // Unfollow Coastal — the row disappears
    const coastalCard = page.locator(".bg-dark.border.border-dark-lighter.rounded-2xl", {
      hasText: COASTAL_ORG,
    });
    await coastalCard.getByRole("button", { name: /unfollow/i }).click();
    await expect(page.getByText(COASTAL_ORG)).not.toBeVisible();
  });
});
