import { test, expect, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { organiserLogin } from "./helpers";

// Prefer the CI-provided DATABASE_URL; locally read it from .env.local (which
// may not exist in CI). Only DATABASE_URL is read — loading the whole file
// would leak NEXT_PUBLIC_* vars (e.g. a real Cognito pool id) into the shared
// worker env and make auth.spec's hasCognito guard run its real-Cognito tests.
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  const dbUrl = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
  if (dbUrl) process.env.DATABASE_URL = dbUrl;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const EVENT_ID = "seed-event-001";
const REG_ID = "seed-reg-checkin-e2e";
// Tom Whitfield (the __e2e_bypass "member" identity). Unlike jade, he has no
// seeded registration on seed-event-001, so the check-in lookup resolves
// unambiguously to the registration this spec creates.
const USER_EMAIL = "tom.whitfield@startline.test";
const ATHLETE_NAME = "Tom Whitfield";

async function setBypass(page: Page, value: string): Promise<void> {
  await page.context().addCookies([
    { name: "__e2e_bypass", value, domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
}

// Generates (or reuses) the event's check-in QR and returns the encoded URL.
async function getCheckinUrl(page: Page): Promise<string> {
  await organiserLogin(page);
  await page.goto(`/organiser/events/${EVENT_ID}/dashboard`);
  await page.getByRole("button", { name: "Check-in QR" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const input = dialog.locator("input[readonly]");
  // The first call in CI cold-compiles the check-in-qr route and the qrcode
  // module, so give the URL a generous window before failing.
  await expect(input).toHaveValue(/\/checkin\//, { timeout: 30000 });
  return (await input.inputValue()).trim();
}

test.beforeAll(async () => {
  const event = await prisma.event.findUnique({
    where: { id: EVENT_ID },
    select: { organiserId: true },
  });
  expect(event, `seeded event ${EVENT_ID} should exist`).toBeTruthy();
  await prisma.registration.upsert({
    where: { id: REG_ID },
    update: { checkedInAt: null },
    create: {
      id: REG_ID,
      eventId: EVENT_ID,
      organiserId: event!.organiserId,
      athleteName: ATHLETE_NAME,
      athleteEmail: USER_EMAIL,
      waveLabel: "General",
      amountCents: 11500,
      platformFeeCents: 0,
      feeStructure: "athlete",
      status: "CONFIRMED",
    },
  });
});

test.afterAll(async () => {
  await prisma.registration.delete({ where: { id: REG_ID } }).catch(() => {});
  await prisma.$disconnect();
});

test("organiser generates a scannable check-in QR for their event", async ({ page }) => {
  const url = await getCheckinUrl(page);
  expect(url).toMatch(new RegExp(`^http://localhost:3000/checkin/${EVENT_ID}/`));
  // The QR image itself renders inside the dialog.
  await expect(page.getByRole("dialog").getByRole("img", { name: /Check-in QR code/ })).toBeVisible();
});

test("logged-out visitor scanning the QR is prompted to sign in", async ({ page }) => {
  const url = await getCheckinUrl(page);
  await page.context().clearCookies();
  await page.goto(url);
  await expect(page.getByText("Sign in to check in")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
});

test("a user not registered for the event sees a clear error", async ({ page }) => {
  const url = await getCheckinUrl(page);
  await page.context().clearCookies();
  await setBypass(page, "avery"); // avery.quinn@startline.test — not registered for seed-event-001
  await page.goto(url);
  await expect(page.getByText("You're not registered for this event")).toBeVisible();
});

test("signed-in registered athlete checks in and sees the confirmed state", async ({ page }) => {
  // Reset to a clean state so this test is idempotent across retries.
  await prisma.registration.update({ where: { id: REG_ID }, data: { checkedInAt: null } });

  const url = await getCheckinUrl(page);
  await setBypass(page, "member"); // tom.whitfield@startline.test
  await page.goto(url);

  await expect(page.getByText("Check in to this event")).toBeVisible();
  await expect(page.getByRole("main").getByText(ATHLETE_NAME)).toBeVisible();

  await page.getByRole("button", { name: "Check In" }).click();
  await expect(page.getByText("You're checked in")).toBeVisible();

  // Re-visiting (or re-scanning) shows the already-checked-in state — no duplicate.
  await page.reload();
  await expect(page.getByText("You're checked in")).toBeVisible();
});

test("organiser dashboard shows the live checked-in count", async ({ page }) => {
  // Check in via the athlete API so the assertion doesn't depend on UI clicks.
  await setBypass(page, "member");
  const res = await page.request.post(`/api/checkin/${EVENT_ID}`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.checkedInAt).toBeTruthy();

  await organiserLogin(page);
  await page.goto(`/organiser/events/${EVENT_ID}/dashboard`);
  await page.getByRole("button", { name: "Check-in QR" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/1 of \d+ checked in/)).toBeVisible();
});
