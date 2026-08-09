import { test, expect } from "@playwright/test";
import { adminLogin } from "./helpers";

const ts = () => Date.now().toString().slice(-6);

async function getApexOrganiserId(page: import("@playwright/test").Page): Promise<string> {
  const res = await page.request.get("/api/admin/organisers");
  expect(res.ok()).toBeTruthy();
  const orgs = await res.json();
  const apex = orgs.find((o: { orgName: string | null }) => o.orgName === "Apex Endurance Events");
  expect(apex).toBeTruthy();
  return apex.id;
}

// Creates an event via the admin API so tests don't have to walk the whole
// wizard for setup. `submit: true` + a verified organiser → APPROVED (live).
async function createEventViaApi(
  page: import("@playwright/test").Page,
  title: string,
  organiserId: string,
  submit = false,
): Promise<string> {
  const res = await page.request.post("/api/admin/events", {
    data: {
      title,
      discipline: "running",
      eventDate: "2027-01-15",
      startTime: "08:00",
      endTime: "10:00",
      venue: "Test Venue",
      address: "1 Test St, Sydney NSW 2000",
      city: "Sydney",
      state: "nsw",
      format: "individual",
      level: "moderate",
      categories: ["10K"],
      cap: 200,
      waves: [{ label: "General", price: "50" }],
      refundPolicy: "No refunds",
      registrationType: "external",
      registrationUrl: "https://example.com/reg",
      submit,
      organiserId,
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.id;
}

test.describe("admin event creation", () => {
  test("events page exposes create and edit actions", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/events?status=APPROVED");

    await expect(page.getByRole("link", { name: /create event/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /edit/i }).first()).toBeVisible();
  });

  test("create page shows organiser selector with seeded organisers", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/events/create");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /create event/i })).toBeVisible();
    const select = page.locator("select").first();
    await expect(select).toBeVisible();
    await expect(select).toContainText("Apex Endurance Events");
    // Wizard below the selector still renders.
    await expect(page.getByText("The Basics").first()).toBeVisible();
  });

  test("admin can fill the create wizard and save a draft", async ({ page }) => {
    await adminLogin(page);
    const organiserId = await getApexOrganiserId(page);
    const title = `E2E Admin Wizard ${ts()}`;

    await page.goto("/admin/events/create");
    await page.waitForLoadState("networkidle");
    await page.locator("select").first().selectOption(organiserId);

    // Step 1 — The Basics
    await page.getByPlaceholder(/Apex Throwdown/i).fill(title);
    await page.getByRole("button", { name: /individual solo athletes/i }).click();
    await page.getByRole("button", { name: /^running/i }).click();
    await page.getByRole("button", { name: /^10K$/i }).click();
    await page.getByRole("button", { name: /moderate/i }).click();
    await page.getByRole("button", { name: /1,000/i }).click();
    await page.getByRole("button", { name: /open to all/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 2 — Date & Location
    await expect(page.getByText(/when and where/i).first()).toBeVisible();
    await page.getByText("Pick start date").click();
    await page.getByRole("button", { name: /today/i }).click();
    await page.locator('input[type="time"]').first().fill("09:00");
    await page.getByPlaceholder(/start typing an address/i).fill("1 Test St, Sydney NSW 2000");
    const cityInput = page.getByPlaceholder(/e.g. Melbourne/i);
    if (await cityInput.isVisible()) await cityInput.fill("Sydney");
    await page.getByRole("combobox", { name: /state/i }).click();
    await page.getByRole("option", { name: /NSW/ }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 3 — Tickets & Pricing
    await page.getByRole("button", { name: /startline/i }).first().click();
    const ticketLabel = page.getByPlaceholder(/general admission/i);
    if (await ticketLabel.isVisible()) await ticketLabel.fill("Standard Entry");
    const ticketPrice = page.locator('input[placeholder="129"]');
    if (await ticketPrice.isVisible()) await ticketPrice.fill("50");
    await page.getByRole("button", { name: /no refunds/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 4 — Media & Description. No cover image is set so the draft save
    // never hits /api/upload (S3) — CI's e2e role is read-only.
    await expect(page.getByText(/cover image/i).first()).toBeVisible();
    const editor = page.locator("[contenteditable]");
    if (await editor.isVisible()) {
      await editor.fill(`E2E description for ${title}`);
    }

    await page.getByRole("button", { name: /save draft/i }).click();
    await page.waitForURL("**/admin/events", { timeout: 20000 });
  });

  test("creating an event on behalf of a verified organiser goes live and is attributed to them", async ({ page }) => {
    await adminLogin(page);
    const organiserId = await getApexOrganiserId(page);
    const title = `E2E Admin Event ${ts()}`;

    const eventId = await createEventViaApi(page, title, organiserId, true);

    // Verified organiser → auto-approved, so it appears on the Approved tab.
    await page.goto("/admin/events?status=APPROVED");
    await expect(page.getByText(title, { exact: false })).toBeVisible({ timeout: 10000 });

    // The event is attributed to the chosen organiser (posted to their profile).
    const evtRes = await page.request.get(`/api/admin/events/${eventId}`);
    expect(evtRes.ok()).toBeTruthy();
    const evt = await evtRes.json();
    expect(evt.organiserId).toBe(organiserId);

    // Audit log records the create.
    const auditRes = await page.request.get("/api/admin/audit?action=CREATE_EVENT&limit=50");
    const audit = await auditRes.json();
    const logs = Array.isArray(audit.logs) ? audit.logs : [];
    expect(logs.some((l: { meta: { title?: string } | null }) => l.meta?.title === title)).toBeTruthy();
  });
});

test.describe("admin event editing", () => {
  test("can edit a live (APPROVED) event without losing live status", async ({ page }) => {
    await adminLogin(page);
    const organiserId = await getApexOrganiserId(page);
    const originalTitle = `E2E Live Edit ${ts()}`;
    const newTitle = `${originalTitle} — edited`;

    const eventId = await createEventViaApi(page, originalTitle, organiserId, true);

    await page.goto(`/admin/events/${eventId}/edit`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /edit event/i })).toBeVisible();

    await page.getByPlaceholder(/Apex Throwdown/i).fill(newTitle);
    await page.getByRole("button", { name: /save draft/i }).click();
    await page.waitForURL("**/admin/events**", { timeout: 20000 });

    // Still APPROVED — shows on the Approved tab with the new title.
    await page.goto("/admin/events?status=APPROVED");
    await expect(page.getByText(newTitle, { exact: false })).toBeVisible({ timeout: 10000 });
  });

  test("can edit a draft event", async ({ page }) => {
    await adminLogin(page);
    const organiserId = await getApexOrganiserId(page);
    const originalTitle = `E2E Draft Edit ${ts()}`;
    const newTitle = `${originalTitle} — edited`;

    const eventId = await createEventViaApi(page, originalTitle, organiserId, false);

    await page.goto(`/admin/events/${eventId}/edit`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByPlaceholder(/Apex Throwdown/i)).toHaveValue(originalTitle);

    await page.getByPlaceholder(/Apex Throwdown/i).fill(newTitle);
    await page.getByRole("button", { name: /save draft/i }).click();
    await page.waitForURL("**/admin/events**", { timeout: 20000 });
  });
});

test.describe("admin user editing", () => {
  // TODO: flaky — refetch can return stale list after save. See issue #227.
  // test("can edit a user's name and see the update in the list", async ({ page }) => {
  //   await adminLogin(page);
  //   const newName = `E2E Updated User ${ts()}`;
  //
  //   await page.goto("/admin/users");
  //   await page.waitForLoadState("networkidle");
  //
  //   await page.getByPlaceholder(/search by name, email, or username/i).fill("harper.jones@startline.test");
  //   await page.getByRole("button", { name: /search/i }).click();
  //
  //   await page.getByRole("button", { name: /edit/i }).first().click();
  //   await expect(page.getByText("Edit user")).toBeVisible();
  //
  //   await page.getByPlaceholder("Full name").fill(newName);
  //
  //   await page.getByRole("button", { name: /save changes/i }).click();
  //
  //   await expect(page.getByText("Edit user")).not.toBeVisible({ timeout: 10000 });
  //   await expect(page.getByText(newName, { exact: false })).toBeVisible({ timeout: 15000 });
  //
  //   // Audit log records the edit.
  //   const auditRes = await page.request.get("/api/admin/audit?action=EDIT_USER&limit=50");
  //   const audit = await auditRes.json();
  //   const logs = Array.isArray(audit.logs) ? audit.logs : [];
  //   expect(
  //     logs.some((l: { meta: { fields?: string[] } | null }) =>
  //       Array.isArray(l.meta?.fields) && l.meta!.fields!.includes("name")),
  //   ).toBeTruthy();
  // });
});
