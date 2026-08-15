import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
import type { JWTPayload } from "jose";

const region   = process.env.NEXT_PUBLIC_AWS_REGION          ?? "";
const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const clientId   = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID    ?? "";

const cognitoDomain = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

const JWKS = createRemoteJWKSet(
  new URL(`${cognitoDomain}/.well-known/jwks.json`)
);

const ORGANISER_PROTECTED = [
  "/organiser/dashboard",
  "/organiser/listings",
  "/organiser/profile",
  "/organiser/members",
  "/organiser/new-listing",
  "/organiser/onboarding",
  "/organiser/payments",
  "/organiser/events",
];

const ADMIN_PROTECTED = [
  "/admin/dashboard",
  "/admin/events",
  "/admin/organisers",
  "/admin/reviews",
  "/admin/users",
  "/admin/registrations",
  "/admin/analytics",
  "/admin/audit",
  "/admin/payouts",
  "/admin/security",
];

const USER_DOMAIN = "startlineau.com";
const ORGANISER_DOMAIN = "organiser.startlineau.com";
const ADMIN_DOMAIN = "admin.startlineau.com";

async function getVerifiedPayload(req: NextRequest): Promise<JWTPayload | null> {
  const lastAuthUser = req.cookies.get(
    `CognitoIdentityServiceProvider.${clientId}.LastAuthUser`
  )?.value;
  if (!lastAuthUser) return null;

  const accessToken = (
    req.cookies.get(`CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.accessToken`)?.value ??
    req.cookies.get(`CognitoIdentityServiceProvider.${clientId}.${encodeURIComponent(lastAuthUser)}.accessToken`)?.value
  );
  if (!accessToken) return null;

  try {
    const { payload } = await jwtVerify(accessToken, JWKS, {
      issuer: cognitoDomain,
      audience: undefined,
    });
    return payload;
  } catch {
    return null;
  }
}

function isAdmin(payload: JWTPayload): boolean {
  const groups = (payload["cognito:groups"] as string[] | undefined) ?? [];
  return groups.includes("admins");
}

const noCognito = !process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
const isBypass = noCognito && process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_AUTH_BYPASS === "true";

export async function middleware(req: NextRequest) {
  if (isBypass) return NextResponse.next();

  if (process.env.NODE_ENV === "development") {
    const bypass = req.cookies.get("__e2e_bypass")?.value;
    if (bypass) return NextResponse.next();
  }

  const { pathname } = req.nextUrl;
  const host = req.headers.get("host") ?? "";

  if (host === ORGANISER_DOMAIN) {
    if (pathname === "/" || pathname === "/organiser") {
      return NextResponse.rewrite(new URL("/organiser-landing", req.url));
    }

    if (ORGANISER_PROTECTED.some((p) => pathname.startsWith(p))) {
      const payload = await getVerifiedPayload(req);
      if (!payload) return NextResponse.redirect(new URL("https://startlineau.com"));
      return NextResponse.next();
    }

    if (
      !pathname.startsWith("/organiser") &&
      !pathname.startsWith("/_next") &&
      !pathname.startsWith("/api") &&
      !pathname.startsWith("/images") &&
      !pathname.startsWith("/favicon")
    ) {
      return NextResponse.redirect(new URL("https://startlineau.com"));
    }

    return NextResponse.next();
  }

  if (host === ADMIN_DOMAIN) {
    if (ADMIN_PROTECTED.some((p) => pathname.startsWith(p))) {
      const payload = await getVerifiedPayload(req);
      if (!payload || !isAdmin(payload)) {
        return NextResponse.redirect(new URL("/admin/login", req.url));
      }
      return NextResponse.next();
    }

    return NextResponse.next();
  }

  if (host === USER_DOMAIN || host === `www.${USER_DOMAIN}`) {
    if (pathname === "/waitlist"
        || pathname.startsWith("/api/waitlist")
        || pathname.startsWith("/_next")
        || pathname.startsWith("/images")
        || pathname.startsWith("/favicon")) {
      return NextResponse.next();
    }
    return NextResponse.rewrite(new URL("/waitlist", req.url));
  }

  if (pathname === "/organiser" || pathname === "/organiser-landing") {
    return NextResponse.rewrite(new URL("/organiser-landing", req.url));
  }

  if (ORGANISER_PROTECTED.some((p) => pathname.startsWith(p))) {
    const payload = await getVerifiedPayload(req);
    if (!payload) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  if (ADMIN_PROTECTED.some((p) => pathname.startsWith(p))) {
    const payload = await getVerifiedPayload(req);
    if (!payload || !isAdmin(payload)) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|images/|favicon.ico).*)",
  ],
};
