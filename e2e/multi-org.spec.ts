import { test, expect } from "@playwright/test";
import { multiOrganiserLogin } from "./helpers";

interface Membership {
  organiserId: string;
  organiserName: string;
  role: string;
}

function eventPayload(title: string, organiserId: string) {
  return {
    title,
    discipline: "running",
    eventDate: "2027-03-14",
    startTime: "08:00",
    city: "Melbourne",
    state: "vic",
    format: "individual",
    level: "moderate",
    cap: 250,
    minAge: 16,
    address: "1 Test St, Melbourne VIC 3000",
    registrationType: "external",
    registrationUrl: "https://example.com/reg",
    waves: [{ label: "Entry", price: "50", closes: "", startTime: "" }],
    refundPolicy: "No refunds",
    submit: true,
    organiserId,
  };
}

// Regression for #231: a multi-org MANAGER (no OWNER role) whose active
// organiser is decided purely by the startline_active_org cookie. A created
// event must land under the organiser it is scoped to, and appear only in that
// organiser's listings — never silently written to a different one.
test.describe("multi-org event scoping", () => {
  test("created event appears only under its scoped organiser", async ({ page }) => {
    await multiOrganiserLogin(page);

    // Avery manages Apex + Coastal with no cookie set, so Apex (the first
    // membership) is the active organiser — same resolution as the listings.
    const membershipsRes = await page.request.get("/api/organiser/memberships");
    expect(membershipsRes.ok()).toBeTruthy();
    const membershipsData = await membershipsRes.json();
    const apex    = membershipsData.memberships.find((m: Membership) => m.organiserName === "Apex Endurance Events");
    const coastal = membershipsData.memberships.find((m: Membership) => m.organiserName === "Coastal Fitness Collective");
    expect(apex).toBeTruthy();
    expect(coastal).toBeTruthy();
    expect(membershipsData.activeOrganiserId).toBe(apex.organiserId);

    const listTitles = async () => {
      const res = await page.request.get("/api/organiser/events");
      expect(res.ok()).toBeTruthy();
      return (await res.json()).map((e: { title: string }) => e.title);
    };

    // Create under Apex (the active organiser — exactly what the wizard sends).
    const apexTitle = `E2E Iron Man Apex ${Date.now()}`;
    const createApex = await page.request.post("/api/organiser/events", {
      data: eventPayload(apexTitle, apex.organiserId),
    });
    expect(createApex.ok()).toBeTruthy();
    expect(await listTitles()).toContain(apexTitle);

    // A request scoped explicitly to Coastal must NOT land in Apex listings.
    // Regression guard: the organiser portal used to ignore any organiserId and
    // silently write to the resolved active org, so this would appear here.
    const coastalTitle = `E2E Coastal Swim ${Date.now()}`;
    const createScoped = await page.request.post("/api/organiser/events", {
      data: eventPayload(coastalTitle, coastal.organiserId),
    });
    expect(createScoped.ok()).toBeTruthy();
    expect(await listTitles()).not.toContain(coastalTitle);

    // Switch to Coastal (cookie + reload, the path the navbar takes): the
    // scoped event appears there, the Apex event is hidden.
    const switchRes = await page.request.post("/api/organiser/switch-org", {
      data: { organiserId: coastal.organiserId },
    });
    expect(switchRes.ok()).toBeTruthy();
    await page.reload();
    await page.waitForLoadState("networkidle");

    const afterSwitch = await (await page.request.get("/api/organiser/memberships")).json();
    expect(afterSwitch.activeOrganiserId).toBe(coastal.organiserId);

    let titles = await listTitles();
    expect(titles).toContain(coastalTitle);
    expect(titles).not.toContain(apexTitle);

    // Switch back to Apex — the Apex event reappears, the Coastal one is hidden.
    const switchBack = await page.request.post("/api/organiser/switch-org", {
      data: { organiserId: apex.organiserId },
    });
    expect(switchBack.ok()).toBeTruthy();
    titles = await listTitles();
    expect(titles).toContain(apexTitle);
    expect(titles).not.toContain(coastalTitle);
  });
});
