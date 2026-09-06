"use client";

import { useEffect } from "react";
import { Amplify } from "aws-amplify";
import { CookieStorage } from "aws-amplify/utils";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import { amplifyConfig } from "@/lib/amplify-config";
import { authCookieDomain } from "@/lib/portal-domains";

Amplify.configure(amplifyConfig, { ssr: true });

const CURRENT_CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "";
const COGNITO_PREFIX = "CognitoIdentityServiceProvider";

// Days. Matches the Cognito refresh-token window; a shorter cookie would sign
// people out while their refresh token is still good.
const COOKIE_DAYS = 30;

// Amplify's default cookie storage writes host-only cookies, so a session
// created on startlineau.com was never sent to organiser.startlineau.com and the
// organiser portal sat permanently signed out (issue #302). Scoping the tokens
// to .startlineau.com makes one sign-in cover all three portals. Anywhere else —
// a single-host Amplify branch domain, a PR preview, localhost — the domain is
// left unset, because naming a domain the browser is not on makes it drop the
// cookie and breaks auth outright.
const cookieDomain =
  typeof window === "undefined" ? undefined : authCookieDomain(window.location.hostname);

const MIGRATION_FLAG = "startline.cognito-cookie-domain.v1";

// Sessions that predate the change are held in host-only cookies. Left in place
// they would sit alongside the new domain-scoped ones under the same names, and
// a browser sends both — oldest first — so the stale copy would shadow the live
// one and the session would rot instead of refreshing. Re-writing each value at
// the shared scope and then deleting the host-only copy carries the session
// across without signing anyone out. Runs once per browser.
function adoptHostOnlyCognitoCookies() {
  if (!cookieDomain) return;
  try {
    if (window.localStorage.getItem(MIGRATION_FLAG)) return;
  } catch {
    // Storage blocked. Re-running is harmless: by then no host-only cookie is
    // left to copy, so every iteration below is a no-op.
  }

  const secure = window.location.protocol === "https:" ? "; secure" : "";
  // Snapshot first — the loop writes cookies, which would otherwise reshape
  // what it is iterating over.
  for (const raw of document.cookie.split(";").slice()) {
    const eq = raw.indexOf("=");
    if (eq < 0) continue;
    const name = raw.slice(0, eq).trim();
    if (!name.startsWith(COGNITO_PREFIX)) continue;
    const value = raw.slice(eq + 1);

    document.cookie =
      `${name}=${value}; path=/; domain=${cookieDomain}; max-age=${COOKIE_DAYS * 86400}; samesite=lax${secure}`;
    // No domain attribute, so this deletes the host-only copy and leaves the
    // one just written at the shared scope.
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }

  try {
    window.localStorage.setItem(MIGRATION_FLAG, "1");
  } catch {
    // See above.
  }
}

if (typeof window !== "undefined") {
  adoptHostOnlyCognitoCookies();
  cognitoUserPoolsTokenProvider.setKeyValueStorage(
    new CookieStorage({
      domain: cookieDomain,
      path: "/",
      expires: COOKIE_DAYS,
      // localhost is served over http, where a Secure cookie is discarded.
      secure: window.location.protocol === "https:",
      sameSite: "lax",
    }),
  );
}

function clearStaleCognitoCookies() {
  const currentPrefix = `${COGNITO_PREFIX}.${CURRENT_CLIENT_ID}`;
  // Clear at both scopes: a delete has to match the domain the cookie was set
  // with, and cookies from before the shared-domain change are host-only.
  const scopes = cookieDomain ? ["", `; domain=${cookieDomain}`] : [""];
  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.split("=")[0].trim();
    if (name.startsWith(COGNITO_PREFIX) && !name.startsWith(currentPrefix)) {
      for (const scope of scopes) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${scope}`;
      }
    }
  });
}

export default function AmplifyProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    clearStaleCognitoCookies();
  }, []);

  return <>{children}</>;
}
