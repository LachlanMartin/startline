import { test, expect } from "@playwright/test";
import { adminLogin } from "./helpers";

// An organiser can now submit a marketplace event without an ABN: the listing
// saves and waits for review instead of being refused at the last step. The
// requirement has to hold on the admin side instead, so the review queue says
// why an event cannot go live and refuses to approve it.
//
// Both seeded organisers have an ABN, so the queue is stubbed rather than
// mutating seed data other specs depend on.

// `organiser` is merged rather than replaced: spreading `over` wholesale would
// drop stripeOnboardingComplete and trip the Stripe blocker instead of the ABN
// one, which is a different assertion entirely.
const row = ({ organiser, ...over }: Record<string, unknown> = {}) => ({
  id: "evt-no-abn",
  title: "Sunrise Trail Half",
  discipline: "running",
  city: "Melbourne",
  state: "VIC",
  eventDate: "2026-11-01",
  startTime: "07:00",
  status: "PENDING",
  isPinned: false,
  createdAt: "2026-09-01T00:00:00.000Z",
  coverImageUrl: null,
  rejectionReason: null,
  reviewedAt: null,
  registrationType: "startline",
  ...over,
  organiser: {
    id: "org-1",
    orgName: "Apex Endurance Events",
    contactName: "Test Organiser",
    email: "sarah.mitchell@startline.test",
    abn: null,
    stripeOnboardingComplete: true,
    ...(organiser as object ?? {}),
  },
});

const stubQueue = async (page: import("@playwright/test").Page, events: unknown[]) => {
  await page.route("**/api/admin/events?status=PENDING**", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ events, total: events.length, page: 1, totalPages: 1 }),
    })
  );
};

test.describe("admin review: organiser profile incomplete", () => {
  test("warns and blocks approval when the organiser has no ABN", async ({ page }) => {
    await stubQueue(page, [row()]);

    // Approving must not even be attempted from the UI.
    let approveCalled = false;
    await page.route("**/api/admin/events/*/review", async route => {
      approveCalled = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await adminLogin(page);
    await page.goto("/admin/events?status=PENDING");

    await expect(page.getByText("Sunrise Trail Half")).toBeVisible();
    await expect(
      page.getByText(/Organiser profile incomplete: No ABN on file/i)
    ).toBeVisible();

    const approve = page.getByRole("button", { name: /^Approve$/i }).first();
    await expect(approve).toBeDisabled();
    expect(approveCalled).toBe(false);
  });

  test("still allows approval once the organiser has an ABN", async ({ page }) => {
    await stubQueue(page, [row({ organiser: { abn: "51 824 753 556" } })]);

    await adminLogin(page);
    await page.goto("/admin/events?status=PENDING");

    await expect(page.getByText("Sunrise Trail Half")).toBeVisible();
    await expect(page.getByText(/Organiser profile incomplete/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Approve$/i }).first()).toBeEnabled();
  });

  // External registration takes no money through Startline, so the ABN the rule
  // protects is not needed and the event must not be held up.
  test("does not hold up an externally-registered event", async ({ page }) => {
    await stubQueue(page, [row({ registrationType: "external" })]);

    await adminLogin(page);
    await page.goto("/admin/events?status=PENDING");

    await expect(page.getByText("Sunrise Trail Half")).toBeVisible();
    await expect(page.getByText(/Organiser profile incomplete/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Approve$/i }).first()).toBeEnabled();
  });
});
