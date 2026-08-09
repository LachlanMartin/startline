import { test, expect } from "@playwright/test";
import { organiserLogin } from "./helpers";

const EVENT_ID = "seed-event-001";
const DASHBOARD = `/organiser/events/${EVENT_ID}/dashboard`;
const MANAGE = `${DASHBOARD}?panel=manage`;

test.describe("race management", () => {
  test("opens race management on the event dashboard", async ({ page }) => {
    await organiserLogin(page);
    await page.goto(DASHBOARD);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /manage registrations/i }).click();
    await page.waitForURL(`**panel=manage**`);
    await expect(page.getByRole("button", { name: /back to overview/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /before race/i })).toBeVisible();
    await expect(page.getByText("Alex Turner").first()).toBeVisible();
  });

  test("legacy /registrations URL redirects into dashboard manage panel", async ({ page }) => {
    await organiserLogin(page);
    await page.goto(`/organiser/events/${EVENT_ID}/registrations`);
    await page.waitForURL(`**/dashboard?panel=manage`);
    await expect(page.getByRole("button", { name: /before race/i })).toBeVisible();
  });

  test("searches the allocation board across every wave", async ({ page }) => {
    await organiserLogin(page);
    await page.goto(MANAGE);
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder(/search any wave/i).fill("Alex Turner");
    await expect(page.getByText("Alex Turner")).toBeVisible();
    await expect(page.getByText("Bree Collins")).toHaveCount(0);
  });

  // TODO: flaky — mutates shared seeded athlete wave state. See issue #227.
  // test("moves an athlete into a wave in bulk", async ({ page }) => {
  //   await organiserLogin(page);
  //   await page.goto(MANAGE);
  //   await page.waitForLoadState("networkidle");
  //
  //   // Oscar starts with no wave (in the Unassigned group). Select and move him.
  //   await page.getByRole("checkbox", { name: /select oscar de luca/i }).click();
  //   await page.getByLabel(/destination wave/i).click();
  //   await page.getByRole("option", { name: "Wave A" }).click();
  //   await page.getByRole("button", { name: /^move$/i }).click();
  //
  //   // The board reports the move; find him again and confirm his wave followed.
  //   await expect(page.getByText(/moved 1 athlete to wave a/i)).toBeVisible();
  //   await page.getByPlaceholder(/search any wave/i).fill("Oscar De Luca");
  //   await expect(page.getByText("Oscar De Luca")).toBeVisible();
  //   // exact avoids also matching the "Moved 1 athlete to Wave A." status line.
  //   await expect(page.getByText("Wave A", { exact: true })).toBeVisible();
  // });

  test("drags an athlete into another wave", async ({ page }) => {
    await organiserLogin(page);
    await page.goto(MANAGE);
    await page.waitForLoadState("networkidle");

    // Grab Dana Wilson's drag handle and drop onto the Wave C group. Idempotent:
    // whether she moves or was already there, she ends in Wave C if the drag works.
    const handle = page.getByRole("button", { name: /drag dana wilson/i });
    await expect(handle).toBeVisible();
    const waveC = page.getByText("Wave C", { exact: true });
    await expect(waveC).toBeVisible();

    // mouse.down() does not auto-scroll the way locator.click() does, so the
    // handle has to be on screen before the press or the drag never starts.
    await handle.scrollIntoViewIfNeeded();
    const hb = (await handle.boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + 30, hb.y + 30, { steps: 4 }); // pass the drag threshold

    // Wave C sits below the fold on a laptop viewport. Hold at the bottom edge
    // and let the board's auto-scroll bring it into reach, exactly as a real
    // organiser would; then drop on it.
    const vh = page.viewportSize()!.height;
    for (let i = 0; i < 10; i++) {
      await page.mouse.move(hb.x + 30, vh - 6, { steps: 2 });
      await page.waitForTimeout(120);
    }
    const tb = (await waveC.boundingBox())!;
    await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 8 });
    await page.mouse.up();

    // Confirm via search that Dana now sits in Wave C. Searching by her name
    // isolates one result row whose wave label reads "Wave C".
    await page.getByPlaceholder(/search any wave/i).fill("Dana Wilson");
    await expect(page.getByText("1 match")).toBeVisible();
    await expect(page.getByText("Wave C", { exact: true })).toBeVisible();
  });

  test("edits wave and bib for an athlete from the board", async ({ page }) => {
    await organiserLogin(page);
    await page.goto(MANAGE);
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder(/search any wave/i).fill("Oscar De Luca");
    await page.getByRole("button", { name: /edit oscar de luca/i }).click();

    const editDialog = page.getByRole("dialog");
    await editDialog.getByLabel(/start wave/i).click();
    await editDialog.getByRole("option", { name: /^Wave B/ }).click();
    await editDialog.getByLabel(/bib number/i).fill("777");
    await editDialog.getByRole("button", { name: /^save$/i }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("#777")).toBeVisible();

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.getByPlaceholder(/search any wave/i).fill("Oscar De Luca");
    await expect(page.getByText("#777")).toBeVisible();
  });

  test("auto-scrolls during a drag so off-screen waves stay reachable", async ({ page }) => {
    await organiserLogin(page);
    await page.goto(MANAGE);
    await page.waitForLoadState("networkidle");

    const handle = page.getByRole("button", { name: /drag dana wilson/i });
    await handle.scrollIntoViewIfNeeded();
    const hb = (await handle.boundingBox())!;
    const vh = page.viewportSize()!.height;

    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + 30, hb.y + 30, { steps: 4 });
    const before = await page.evaluate(() => window.scrollY);
    for (let i = 0; i < 10; i++) {
      await page.mouse.move(hb.x + 30, vh - 6, { steps: 2 });
      await page.waitForTimeout(120);
    }
    const after = await page.evaluate(() => window.scrollY);
    await page.mouse.up();

    expect(after).toBeGreaterThan(before);
  });

  test("moves an athlete with the keyboard from the drag handle", async ({ page }) => {
    await organiserLogin(page);
    await page.goto(MANAGE);
    await page.waitForLoadState("networkidle");

    const handle = page.getByRole("button", { name: /drag george kim/i });
    await handle.scrollIntoViewIfNeeded();
    await handle.focus();

    // Enter picks the athlete up; the board says so for sighted keyboard users.
    // (The same text also sits in an aria-live region, hence the exact span.)
    await page.keyboard.press("Enter");
    await expect(page.getByText("Moving George Kim", { exact: true })).toBeVisible();

    // Arrow to the next wave, Enter to drop, and the move is reported.
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.getByText(/moved 1 athlete to/i)).toBeVisible();
  });

  test("Escape cancels a keyboard move without changing the wave", async ({ page }) => {
    await organiserLogin(page);
    await page.goto(MANAGE);
    await page.waitForLoadState("networkidle");

    const handle = page.getByRole("button", { name: /drag ivy martin/i });
    await handle.scrollIntoViewIfNeeded();
    await handle.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Moving Ivy Martin", { exact: true })).toBeVisible();

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");

    // The pick-up is dropped and nothing was moved.
    await expect(page.getByText("Moving Ivy Martin", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/moved \d+ athlete/i)).toHaveCount(0);
  });

  test("edit dialog wave change regroups the board without a refresh", async ({ page }) => {
    await organiserLogin(page);
    await page.goto(MANAGE);
    await page.waitForLoadState("networkidle");

    // Leo is seeded into Wave C by finish time; move him to Wave A and the row
    // must follow immediately (the board groups by wave id, not label).
    await page.getByPlaceholder(/search any wave/i).fill("Leo Robinson");
    await page.getByRole("button", { name: /edit leo robinson/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/start wave/i).click();
    await dialog.getByRole("option", { name: /^Wave A/ }).click();
    await dialog.getByRole("button", { name: /^save$/i }).click();
    await expect(dialog).toHaveCount(0);

    const row = page.locator("div", { hasText: /^Leo Robinson/ }).last();
    await expect(row.getByText("Wave A", { exact: true })).toBeVisible();
  });

  test("rejects an unreadable finish time instead of publishing it", async ({ page }) => {
    await organiserLogin(page);
    await page.goto(MANAGE);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /after race/i }).click();

    const block = page
      .locator("div.flex.items-center.gap-2", { hasText: "Jack Thompson" })
      .filter({ hasText: /@/ })
      .first();
    await block.getByRole("button", { name: /add result|edit result/i }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/^time$/i).fill("banana");
    await dialog.getByRole("button", { name: /save result/i }).click();

    // Dialog stays open with a message rather than saving junk to the profile.
    await expect(dialog).toHaveCount(1);
    await expect(dialog.getByText(/must look like/i)).toBeVisible();

    // A real time still saves.
    await dialog.getByLabel(/^time$/i).fill("1:08:22");
    await dialog.getByRole("button", { name: /save result/i }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("rejects an unreadable estimated finish instead of wiping it", async ({ page }) => {
    await organiserLogin(page);
    await page.goto(MANAGE);
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder(/search any wave/i).fill("Kara Adams");
    await page.getByRole("button", { name: /edit kara adams/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/estimated finish/i).fill("whenever");
    await dialog.getByRole("button", { name: /^save$/i }).click();

    await expect(dialog).toHaveCount(1);
    await expect(dialog.getByText(/must look like/i)).toBeVisible();
  });

  test("CSV upload reports unmatched emails and unreadable times", async ({ page }) => {
    await organiserLogin(page);
    await page.goto(MANAGE);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /after race/i }).click();

    await page.getByRole("button", { name: /upload results csv/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("textarea").fill(
      "email,time,placement\n" +
      "eli.patel@example.com,44:12,5\n" +
      "hannah.jones@example.com,not-a-time,6\n" +
      "nobody@nowhere.com,30:00,9"
    );
    await dialog.getByRole("button", { name: /^upload$/i }).click();

    // One good row applied, and neither bad row is allowed to pass silently.
    await expect(dialog.getByText(/updated 1 result/i)).toBeVisible();
    await expect(dialog.getByText(/no athlete matched: nobody@nowhere\.com/i)).toBeVisible();
    await expect(dialog.getByText(/unreadable time/i)).toBeVisible();
  });

  test("every wave-builder input has an accessible name", async ({ page }) => {
    await organiserLogin(page);
    await page.goto(MANAGE);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /manage waves/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const unlabelled = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]')!;
      return [...d.querySelectorAll("input")].filter((i) => {
        const id = i.getAttribute("id");
        return !(
          (id && d.querySelector(`label[for="${id}"]`)) ||
          i.closest("label") ||
          i.getAttribute("aria-label") ||
          i.getAttribute("aria-labelledby")
        );
      }).length;
    });
    expect(unlabelled).toBe(0);
  });

  test("an optimistic move rolls back and reports the error when the server fails", async ({ page }) => {
    await organiserLogin(page);
    await page.goto(MANAGE);
    await page.waitForLoadState("networkidle");

    await page.route("**/registrations/move", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Server exploded." }),
      }),
    );

    await page.getByPlaceholder(/search any wave/i).fill("Fatima Hassan");
    const before = await page.locator("div", { hasText: /^Fatima Hassan/ }).last().innerText();

    await page.getByRole("checkbox", { name: /select fatima hassan/i }).click();
    await page.getByLabel(/destination wave/i).click();
    await page.getByRole("option", { name: "Wave A" }).click();
    await page.getByRole("button", { name: /^move$/i }).click();

    // The organiser is told, and the row snaps back rather than lying.
    await expect(page.getByText(/server exploded/i)).toBeVisible();
    expect(await page.locator("div", { hasText: /^Fatima Hassan/ }).last().innerText()).toBe(before);
  });

  test("exports Excel workbook from Export menu", async ({ page }) => {
    test.setTimeout(60_000);
    await organiserLogin(page);
    await page.goto(MANAGE);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /^export$/i }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("menuitem", { name: /excel workbook/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
  });

  test("exports PDF start list from Export menu", async ({ page }) => {
    test.setTimeout(60_000);
    await organiserLogin(page);
    await page.goto(MANAGE);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /^export$/i }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("menuitem", { name: /pdf start list/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  });

  test("sets a race result via dialog", async ({ page }) => {
    await organiserLogin(page);
    await page.goto(MANAGE);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /after race/i }).click();

    // Wave-grouped results board (same layout as Before race).
    await expect(page.getByText("Wave C").first()).toBeVisible();

    const athleteBlock = page
      .locator("div.flex.items-center.gap-2", { hasText: "Alex Turner" })
      .filter({ hasText: /alex\.turner@|@example\.com/i })
      .first();
    await athleteBlock.getByRole("button", { name: /add result|edit result/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/division/i).first()).toBeVisible();
    await dialog.getByLabel(/^time$/i).fill("55:01");
    await dialog.getByLabel(/placement/i).fill("1st / 12");
    await dialog.getByRole("button", { name: /save result/i }).click();

    await expect(dialog).toHaveCount(0);
    const updated = page
      .locator("div.flex.items-center.gap-2", { hasText: "Alex Turner" })
      .filter({ hasText: /@/ })
      .first();
    await expect(updated.getByText(/55:01/)).toBeVisible();
    await expect(updated.getByText(/1st \/ 12/)).toBeVisible();
  });

  test("bulk-uploads results via CSV", async ({ page }) => {
    await organiserLogin(page);
    await page.goto(MANAGE);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /after race/i }).click();

    await page.getByRole("button", { name: /upload results csv/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("textarea").fill(
      "email,time,placement\n" +
      "bree.collins@example.com,42:10,3rd / 12"
    );
    await dialog.getByRole("button", { name: /^upload$/i }).click();
    await expect(dialog.getByText(/updated/i)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(
      page
        .locator("div.flex.items-center.gap-2", { hasText: "Bree Collins" })
        .filter({ hasText: /@/ })
        .first()
        .getByText(/42:10/),
    ).toBeVisible();
  });

  // TODO: flaky — mutates shared seeded registration state across runs. See issue #227.
  // test("a refund-requested athlete moves to the Refunds tab and leaves the board", async ({ page }) => {
  //   await organiserLogin(page);
  //   await page.goto(MANAGE);
  //   await page.waitForLoadState("networkidle");
  //
  //   // Flag a confirmed athlete as refund-requested via the board edit dialog.
  //   await page.getByPlaceholder(/search any wave/i).fill("Cameron Nguyen");
  //   await page.getByRole("button", { name: /edit cameron nguyen/i }).click();
  //   const editDialog = page.getByRole("dialog");
  //   await editDialog.getByLabel(/^status$/i).click();
  //   await editDialog.getByRole("option", { name: /refund requested/i }).click();
  //   await editDialog.getByRole("button", { name: /^save$/i }).click();
  //   await expect(page.getByRole("dialog")).toHaveCount(0);
  //
  //   // Shows up under Refunds with the right status...
  //   await page.getByRole("button", { name: /refunds/i }).click();
  //   const refundRow = page.locator("tr", { hasText: "Cameron Nguyen" });
  //   await expect(refundRow).toBeVisible();
  //   await expect(refundRow.getByText(/refund requested/i)).toBeVisible();
  //
  //   // ...and is no longer in the allocation board, which only holds confirmed athletes.
  //   await page.getByRole("button", { name: /before race/i }).click();
  //   await page.getByPlaceholder(/search any wave/i).fill("Cameron Nguyen");
  //   await expect(page.getByText("Cameron Nguyen")).toHaveCount(0);
  // });
});

test.describe("athlete refund requests", () => {
  // The bypass session is the seeded organiser user, who also holds a couple of
  // their own registrations — one on a past event, one upcoming.
  async function ownRegistrations(page: import("@playwright/test").Page) {
    await organiserLogin(page);
    const res = await page.request.get("/api/user/registrations");
    expect(res.ok()).toBeTruthy();
    const { registrations } = await res.json();
    return registrations as { id: string; status: string; event: { eventDate: string } }[];
  }

  test("refuses a refund on an event that has already happened", async ({ page }) => {
    const regs = await ownRegistrations(page);
    const today = new Date().toISOString().slice(0, 10);
    const past = regs.find((r) => r.status === "CONFIRMED" && r.event.eventDate < today);
    test.skip(!past, "no seeded past-event registration for this user");

    const res = await page.request.post(`/api/user/registrations/${past!.id}/refund-request`);
    expect(res.status()).toBe(409);
    expect((await res.json()).error).toMatch(/already taken place/i);

    // Still confirmed — a rejected request must not half-apply.
    const after = await ownRegistrations(page);
    expect(after.find((r) => r.id === past!.id)?.status).toBe("CONFIRMED");
  });

  test("refund request is idempotent", async ({ page }) => {
    const regs = await ownRegistrations(page);
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = regs.find((r) => r.status === "CONFIRMED" && r.event.eventDate >= today);
    test.skip(!upcoming, "no seeded upcoming registration for this user");

    const first = await page.request.post(`/api/user/registrations/${upcoming!.id}/refund-request`);
    expect(first.status()).toBe(200);
    expect((await first.json()).status).toBe("REFUND_REQUESTED");

    const second = await page.request.post(`/api/user/registrations/${upcoming!.id}/refund-request`);
    expect(second.status()).toBe(200);
    expect((await second.json()).alreadyRequested).toBe(true);
  });
});

test.describe("athlete public profile race history", () => {
  test("renders race history for seeded athlete", async ({ page }) => {
    await page.goto("/profile/jade-nguyen");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /jade nguyen/i })).toBeVisible();
    await expect(page.getByText(/race history/i)).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /^division$/i })).toBeVisible();
    // Seeded result on Apex Bay Run (Jade Nguyen's race history)
    await expect(page.getByText(/apex bay run|00:42:10/i).first()).toBeVisible();
  });

  test("shows not-found for unknown username", async ({ page }) => {
    await page.goto("/profile/no-such-athlete-xyz");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/profile not found/i)).toBeVisible();
  });
});
