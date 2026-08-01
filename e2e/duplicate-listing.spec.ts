import { test, expect } from "@playwright/test";
import { organiserLogin } from "./helpers";

test.describe("duplicate listing", () => {
  test("API duplicates into a draft with title and date +7 days", async ({ page }) => {
    await organiserLogin(page);

    const sourceRes = await page.request.get("/api/organiser/events/seed-event-001");
    expect(sourceRes.ok()).toBeTruthy();
    const source = await sourceRes.json();

    const dupRes = await page.request.post("/api/organiser/events/seed-event-001/duplicate");
    expect(dupRes.ok()).toBeTruthy();
    const { id } = await dupRes.json();
    expect(id).toBeTruthy();
    expect(id).not.toBe("seed-event-001");

    const draftRes = await page.request.get(`/api/organiser/events/${id}`);
    expect(draftRes.ok()).toBeTruthy();
    const draft = await draftRes.json();
    expect(draft.status).toBe("DRAFT");
    expect(draft.title).toBe(source.title);
    expect(draft.eventDate).toBe("2026-08-22"); // source 2026-08-15 + 7
    expect(draft.endDate).toBe("2026-08-23"); // source 2026-08-16 + 7
  });

  test("Duplicate listing from listings menu opens wizard with copied title", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/listings");
    await page.waitForLoadState("networkidle");

    // Desktop row for the Apex seed event (hidden sm:grid rows).
    const apexRow = page
      .locator("div.hidden.sm\\:grid")
      .filter({ hasText: "The Apex Throwdown 2026" })
      .first();
    await expect(apexRow).toBeVisible();
    await apexRow.locator(".relative > button").click();

    const dup = page.getByRole("button", { name: /duplicate listing/i });
    await expect(dup).toBeVisible();
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/duplicate") && r.request().method() === "POST"),
      page.waitForURL(/\/organiser\/new-listing\?id=/),
      dup.click(),
    ]);

    await page.waitForLoadState("networkidle");
    const titleInput = page.getByPlaceholder(/Apex Throwdown/i);
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveValue("The Apex Throwdown 2026");
  });
});

test.describe("verified organiser publish", () => {
  test("create+submit as verified organiser returns APPROVED", async ({ page }) => {
    await organiserLogin(page);

    const res = await page.request.post("/api/organiser/events", {
      data: {
        submit: true,
        title: `E2E Live Notify ${Date.now()}`,
        discipline: "running",
        eventDate: "2026-09-01",
        startTime: "06:30",
        endTime: "08:00",
        city: "Sydney",
        state: "nsw",
        venue: "Centennial Park",
        format: "individual",
        level: "open",
        categories: ["5K"],
        waves: [{ label: "General", price: "0" }],
        registrationType: "external",
        registrationUrl: "https://example.com/register",
        feeStructure: "athlete",
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe("APPROVED");
    expect(body.id).toBeTruthy();
  });
});
