/**
 * Proves where a deployed environment rejects an upload, and whether the
 * direct-to-S3 path is live.
 *
 * Uploads used to POST the file through /api/upload, which runs on Amplify's
 * WEB_COMPUTE (Lambda-backed) platform. The multipart body is base64-encoded
 * into the invocation payload, so the 6 MB payload ceiling lands just under
 * 4.5 MB of actual file. Files between that and our own 10 MB cap were killed
 * by the platform before any of our code ran, with a 413 carrying no body at
 * all, which is why the wizard could only say "please try again".
 *
 * No credentials needed. An unauthenticated POST is a clean probe: if it
 * reaches our handler it answers 401 with JSON, and if the platform kills it
 * first you see the platform's answer instead. The status tells you which
 * layer replied.
 *
 * Usage:
 *   node scripts/probe-upload-ceiling.mjs                 # staging
 *   node scripts/probe-upload-ceiling.mjs <base-url>      # any environment
 *   pnpm upload:probe
 *
 * Exits non-zero if the fix has regressed.
 */

const STAGING = "https://main.d2tvgx9pzd2e81.amplifyapp.com";
const base = (process.argv[2] || STAGING).replace(/\/$/, "");

// Either side of the measured ceiling, plus the size that was reported failing.
const SIZES_KB = [1024, 4096, 4400, 4608, 8192];
const KB = 1024;

const post = async (url, bytes) => {
  const form = new FormData();
  form.append("type", "photo");
  form.append("file", new Blob([Buffer.alloc(bytes, 0x7f)], { type: "image/jpeg" }), "probe.jpg");
  const res = await fetch(url, { method: "POST", body: form });
  return { status: res.status, body: (await res.text()).slice(0, 120) };
};

const mb = kb => (kb / 1024).toFixed(2);

async function main() {
  console.log(`\nProbing ${base}\n`);

  // 1. Is the direct-to-S3 path deployed at all? A 404 means this environment
  //    is still running the old code and every other result below is moot.
  console.log("1. Direct-to-S3 route");
  let presignLive = false;
  try {
    const res = await fetch(`${base}/api/upload/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "photo", contentType: "image/jpeg", size: 8 * 1024 * KB }),
    });
    presignLive = res.status !== 404;
    console.log(
      `  ${presignLive ? "PASS" : "FAIL"} /api/upload/presign -> ${res.status}` +
        (presignLive
          ? " (401 unauthenticated is correct; the route is deployed)"
          : " (not deployed: this environment still proxies uploads)")
    );
  } catch (err) {
    console.log(`  FAIL /api/upload/presign -> unreachable: ${err.message}`);
  }
  if (!presignLive) process.exitCode = 1;

  // 2. Show the ceiling that made the fix necessary. This probes the legacy
  //    proxy route, which still exists to serve local dev.
  console.log("\n2. Compute-runtime payload ceiling (legacy /api/upload)");
  let lastOk = null;
  let firstRejected = null;
  for (const kb of SIZES_KB) {
    let line;
    try {
      const { status, body } = await post(`${base}/api/upload`, kb * KB);
      const reachedHandler = status === 401 && body.includes("Unauthorised");
      if (reachedHandler) lastOk = kb;
      if (status === 413 && firstRejected === null) firstRejected = kb;
      line =
        `  ${String(mb(kb)).padStart(5)} MB -> ${status}` +
        (reachedHandler
          ? "  reached our handler"
          : status === 413
            ? "  killed by the platform, empty body"
            : `  ${body.replace(/\s+/g, " ").trim() || "(no body)"}`);
    } catch (err) {
      line = `  ${String(mb(kb)).padStart(5)} MB -> error: ${err.message}`;
    }
    console.log(line);
  }

  console.log("\n3. Verdict");
  if (lastOk !== null && firstRejected !== null) {
    console.log(
      `  Ceiling sits between ${mb(lastOk)} MB and ${mb(firstRejected)} MB on the compute runtime.`
    );
  }
  if (presignLive) {
    console.log("  PASS Uploads bypass the ceiling: the browser posts straight to S3.");
    console.log("       Now upload a >5 MB photo through the event wizard to confirm end to end.");
  } else {
    console.log("  FAIL The presign route is missing, so uploads still route through compute");
    console.log("       and anything over ~4.5 MB will fail. Deploy the fix to this environment.");
  }
  console.log("");
}

main().catch(err => {
  console.error(`\nProbe failed: ${err.message}\n`);
  process.exit(1);
});
