/**
 * Cloudflare Turnstile bot detection.
 *
 * The widget runs in the browser (see components/TurnstileWidget.tsx) and
 * produces a token; this module verifies that token server-side against
 * Cloudflare's siteverify endpoint. Never trust the token alone — the server
 * check is the enforcement point.
 *
 * Dev/test: when the secret keys are not configured we fail open (accept), so
 * local dev and the E2E suite work without a real Turnstile widget. When keys
 * ARE configured a missing/invalid token is rejected.
 */
import { getClientIp } from "@/lib/client-ip";
import { recordSecurityEvent } from "@/lib/security-event";
import { NextRequest, NextResponse } from "next/server";

export function turnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

// Hostnames where bot checks are enforced. Everywhere else (Amplify preview
// URLs, localhost, staging aliases) we fail open — those hostnames aren't
// whitelisted on the Cloudflare Turnstile widget, so the widget errors out and
// no token is ever produced. ponytail: preview hostnames are dynamic and can't
// be enumerated; gate on the known production set instead.
const BOT_CHECK_HOSTS = new Set([
  "startlineau.com",
  "www.startlineau.com",
  "staging.startlineau.com",
]);

function botCheckApplicable(req?: NextRequest): boolean {
  if (!req) return true;
  const host = (req.headers.get("host") ?? "").replace(/:\d+$/, "");
  return BOT_CHECK_HOSTS.has(host);
}

type VerifyResult = { success: boolean };

export async function verifyTurnstileToken(
  token: string | null | undefined,
  req?: NextRequest,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // ponytail: not configured → fail open (dev/test)

  if (!token) return false;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        response: token,
        ...(req ? { remoteip: getClientIp(req) } : {}),
      }),
    });
    const data = (await res.json()) as VerifyResult;
    return data.success === true;
  } catch {
    // ponytail: siteverify unreachable → fail closed (don't trust a token we
    // couldn't check). A transient outage blocks the form rather than letting
    // bots through.
    return false;
  }
}

/**
 * Verify a Turnstile token from a request body, recording a failed check for
 * admin visibility. Returns a 400 response to short-circuit the handler, or
 * null to let the request through. Fail-open when Turnstile is unconfigured.
 */
export async function assertTurnstile(
  req: NextRequest,
  body: { turnstileToken?: string | null } | null | undefined,
  action: string,
): Promise<NextResponse | null> {
  if (!botCheckApplicable(req)) return null;
  if (await verifyTurnstileToken(body?.turnstileToken, req)) return null;
  await recordSecurityEvent({
    type: "bot_check_failed",
    action,
    ip: getClientIp(req),
  });
  return NextResponse.json(
    { error: "Could not verify you're human. Please try again." },
    { status: 400 },
  );
}
