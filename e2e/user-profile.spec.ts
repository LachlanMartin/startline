import { test, expect } from "@playwright/test";

const BYPASS_COOKIE = { name: "__e2e_bypass", value: "1", domain: "localhost", path: "/", sameSite: "Lax" as const };

// Bypass cookie maps server-side to organiser@startline.test, which owns
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

test.describe("public profile", () => {
  test("matches signed-in profile layout without edit controls", async ({ page }) => {
    // Public API needs no auth — pick the first available public profile.
    const candidates = ["jade-nguyen", "sarah-mitchell", "sweet"];
    let username: string | null = null;
    for (const candidate of candidates) {
      const res = await page.request.get(`/api/user/profile/${candidate}`);
      if (res.ok()) {
        username = candidate;
        break;
      }
    }
    test.skip(!username, "no public profile available for e2e");

    await page.goto(`/profile/${username}`);
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByRole("heading", { name: username!, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /race history/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /edit profile/i })).toHaveCount(0);
    // Public view must not use the old "Events Attended" list layout
    await expect(page.getByText(/events attended/i)).toHaveCount(0);
  });
});

test.describe("user profile: race history", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([BYPASS_COOKIE]);
  });

  test("shows KStats and chronological race history from completed registrations", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    // Bypass user is organiser@startline.test — seeded with 2 completed events
    await expect(page.getByRole("heading", { name: /race history/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /edit profile/i })).toBeVisible();
    await expect(page.getByText("The Apex Throwdown 2025")).toBeVisible();
    await expect(page.getByText("Apex Bay Run")).toBeVisible();

    // Results + times are shown for seeded registrations (result renders in
    // both the mobile and desktop regions of the card; desktop is visible here)
    await expect(page.getByText("5th", { exact: true }).last()).toBeVisible();
    await expect(page.getByText("02:01:12", { exact: true }).last()).toBeVisible();

    // Edit opens a modal with photo + public/private fields (no internal User ID)
    await page.getByRole("button", { name: /edit profile/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/profile photo/i)).toBeVisible();
    await expect(dialog.getByText(/^Public profile$/).first()).toBeVisible();
    await expect(dialog.getByText(/private details/i)).toBeVisible();
    await expect(dialog.getByText(/prefill your own event registrations/i)).toBeVisible();
    await expect(dialog.getByLabel(/full name/i)).toBeVisible();
    await expect(dialog.getByLabel(/^phone$/i)).toBeVisible();
    await expect(dialog.getByLabel(/date of birth/i)).toBeVisible();
    await expect(dialog.getByLabel(/^gender$/i)).toBeVisible();
    await expect(dialog.getByLabel(/emergency contact name/i)).toBeVisible();
    await expect(dialog.getByLabel(/emergency contact phone/i)).toBeVisible();
    await expect(dialog.getByText(/user id/i)).toHaveCount(0);
    await expect(dialog.getByText(/location/i)).toHaveCount(0);

    await dialog.getByPlaceholder("A short line about you as an athlete").fill("#testing");
    await dialog.getByRole("button", { name: /^save$/i }).click();
    await expect(dialog).toBeHidden({ timeout: 10000 });
    await expect(page.getByText("#testing").last()).toBeVisible();
  });

  test("saving an event from the listing appears on the activity Saved tab", async ({ page }) => {
    // Take the event from the rendered listing itself (not /api/events, which
    // can include dates the listing filters out) so the card is guaranteed to
    // exist before we click its save button.
    await page.goto("/events?view=list");
    const card = page.locator('a[href^="/events/"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    const eventId = (await card.getAttribute("href"))!.split("/").pop()!;
    const title = await card.locator("h3").innerText();

    // Idempotent across runs: start with this event unsaved, then reload so
    // the heart reflects the fresh saved-state.
    await page.request.delete("/api/user/saved-events", { data: { eventId } });
    await page.reload();
    await expect(card).toBeVisible({ timeout: 15000 });

    await card.locator('[aria-label="Save event"]').click();
    await expect(card.locator('[aria-label="Unsave event"]')).toBeVisible();

    await page.goto("/activity");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /saved/i }).click();
    await expect(page.getByText(title, { exact: false }).first()).toBeVisible({ timeout: 15000 });

    // Cleanup — leave the DB saved-free for the next run.
    await page.request.delete("/api/user/saved-events", { data: { eventId } });
  });

  test("Following tab lists followed organisers and can unfollow", async ({ page }) => {
    // Re-follow Coastal so the test is deterministic even if a prior run
    // unfollowed it (the DELETE persists in the DB).
    const coastalId = await coastalOrganiserId(page);
    await page.request.post(`/api/public/organisers/${coastalId}/follow`);

    await page.goto("/activity");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /following/i }).click();

    // The Following tab also lists a "posted a new event" feed item that
    // mentions the organiser's name, so scope to the followed-organiser card
    // rather than matching the org name anywhere on the tab.
    const coastalCard = page.locator(".bg-dark.border.border-dark-lighter.rounded-2xl", {
      hasText: COASTAL_ORG,
    });
    await expect(coastalCard).toBeVisible();

    // Unfollow Coastal — the row disappears
    await coastalCard.getByRole("button", { name: /unfollow/i }).click();
    await expect(coastalCard).not.toBeVisible();
  });
});
