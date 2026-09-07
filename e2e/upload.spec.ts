import { test, expect } from "@playwright/test";
import { organiserLogin } from "./helpers";

// Uploads used to POST the file through /api/upload, which runs on Amplify's
// WEB_COMPUTE platform. Its Lambda payload ceiling lands just under 4.5 MB of
// file once the multipart body is base64-encoded (measured: 4.30 MB reaches the
// handler, 4.50 MB gets an empty-bodied 413), well under the 10 MB the app
// allows, so a normal phone or stock photo was rejected by the platform before
// any of our code ran. The browser now asks for a signature and posts straight
// to S3 instead.
//
// Locally there is no bucket, so /api/upload/presign answers {mode:"proxy"}.
// These stubs stand in for a deployed environment answering {mode:"s3"}, which
// is the path that has to work on Amplify.

// A realistic bucket origin, so this also proves the CSP connect-src allows
// the host a presigned POST actually targets.
const S3_ORIGIN = "https://startline-staging-uploads.s3.ap-southeast-2.amazonaws.com";
const KEY = "uploads/org_1/cover/signed-object.jpg";
const CDN_URL = `https://cdn.example.test/${KEY}`;

// Bigger than the compute runtime would have accepted, smaller than our cap:
// exactly the range that used to fail.
const SIX_MB_JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(6 * 1024 * 1024, 0x7f),
]);

test.describe("image upload", () => {
  test("posts the file straight to S3 and has the server verify it", async ({ page }) => {
    let presignBody: Record<string, unknown> | null = null;
    let completeBody: Record<string, unknown> | null = null;
    let s3Posted = false;

    await page.route("**/api/upload/presign", async route => {
      presignBody = JSON.parse(route.request().postData() ?? "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          mode: "s3",
          url: `${S3_ORIGIN}/`,
          fields: { key: KEY, "Content-Type": "image/jpeg" },
          key: KEY,
          fileUrl: CDN_URL,
        }),
      });
    });

    await page.route(`${S3_ORIGIN}/**`, async route => {
      s3Posted = true;
      // S3 answers a browser POST with 204 and no body.
      await route.fulfill({ status: 204, body: "" });
    });

    await page.route("**/api/upload/complete", async route => {
      completeBody = JSON.parse(route.request().postData() ?? "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ fileUrl: CDN_URL }),
      });
    });

    // The modal saves the returned URL onto the profile straight away.
    await page.route("**/api/organiser/profile", async route => {
      if (route.request().method() !== "PUT") return route.fallback();
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    // The file must never reach our own API: that is the whole bug.
    let proxied = false;
    await page.route("**/api/upload", async route => {
      proxied = true;
      await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    });

    await organiserLogin(page);
    await page.goto("/organiser/profile");
    await page.getByRole("button", { name: "Edit Profile" }).click();
    await expect(page.getByText("Cover photo")).toBeVisible();

    await page.locator('input[type="file"]').first().setInputFiles({
      name: "pexels-runffwpu-5840726.jpg",
      mimeType: "image/jpeg",
      buffer: SIX_MB_JPEG,
    });

    await expect.poll(() => completeBody, { timeout: 20000 }).not.toBeNull();

    expect(proxied).toBe(false);
    expect(s3Posted).toBe(true);
    expect(presignBody).toMatchObject({ type: "cover", contentType: "image/jpeg" });
    expect(presignBody!.size).toBe(SIX_MB_JPEG.byteLength);
    expect(completeBody).toMatchObject({ key: KEY, type: "cover", contentType: "image/jpeg" });
  });

  test("surfaces the server's reason when a file is refused", async ({ page }) => {
    await page.route("**/api/upload/presign", route =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Image must be 10 MB or smaller." }),
      })
    );

    await organiserLogin(page);
    await page.goto("/organiser/profile");
    await page.getByRole("button", { name: "Edit Profile" }).click();
    await expect(page.getByText("Cover photo")).toBeVisible();

    await page.locator('input[type="file"]').first().setInputFiles({
      name: "too-big.jpg",
      mimeType: "image/jpeg",
      buffer: SIX_MB_JPEG,
    });

    // The reason has to reach the organiser rather than a blanket failure.
    await expect(page.getByText("Image must be 10 MB or smaller.")).toBeVisible({ timeout: 20000 });
  });
});
