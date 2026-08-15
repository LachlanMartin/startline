import { cookies } from "next/headers";
import { jwtVerify, createRemoteJWKSet } from "jose";
import type { OrganiserRole } from "@prisma/client";
import prisma from "./prisma";

export type ServerSession = {
  sub:          string;
  email:        string;
  groups:       string[];
  phoneNumber?: string;
  birthdate?:   string;
};

export type UserSession = {
  sub:          string; // Prisma User.id
  email:        string;
  name:         string | null;
  phoneNumber?: string;
  birthdate?:   string;
};

export type OrganiserSession = {
  sub:      string; // Prisma Organiser.id
  email:    string;
  status:   string;
  verified: boolean;
  role:     OrganiserRole;
};

export type OrganiserMembership = {
  organiserId:   string;
  organiserName: string | null;
  role:          OrganiserRole;
};

export type AdminSession = {
  sub:   string; // Prisma Admin.id
  email: string;
  name:  string | null;
};

const region   = process.env.NEXT_PUBLIC_AWS_REGION          ?? "";
const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const clientId   = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID    ?? "";

const cognitoDomain = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

const JWKS = createRemoteJWKSet(
  new URL(`${cognitoDomain}/.well-known/jwks.json`)
);

async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: cognitoDomain,
    audience: undefined,
  });
  return payload;
}

export async function getServerSession(): Promise<ServerSession | null> {
  const noCognito = !process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  // Dev-only bypass: grants an admins session to every caller. Never honour in
  // production even if the flag is set, or a missing pool ID makes the whole
  // admin API public.
  const isBypass = noCognito && process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_AUTH_BYPASS === "true";
  if (isBypass) {
    return {
      sub: "dev-bypass-organiser",
      email: "sarah.mitchell@startline.test",
      groups: ["admins"],
    };
  }

  if (process.env.NODE_ENV === "development") {
    const cookieStore = await cookies().catch(() => null);
    const bypass = cookieStore?.get("__e2e_bypass")?.value;
    if (bypass) {
      const identities: Record<string, ServerSession> = {
        "1":        { sub: "dev-bypass-organiser", email: "sarah.mitchell@startline.test",  groups: ["admins"] },
        "organiser": { sub: "dev-bypass-organiser", email: "sarah.mitchell@startline.test",  groups: [] },
        "member":   { sub: "dev-bypass-member",    email: "tom.whitfield@startline.test",   groups: [] },
        "admin":    { sub: "dev-bypass-admin",     email: "marcus.stirling@startline.test", groups: ["admins"] },
        "user":     { sub: "dev-bypass-user",      email: "jade.nguyen@startline.test",      groups: [] },
      };
      const identity = identities[bypass];
      if (identity) return identity;
    }
  }

  try {
    const cookieStore = await cookies();

    const lastAuthUser = cookieStore.get(
      `CognitoIdentityServiceProvider.${clientId}.LastAuthUser`
    )?.value;
    if (!lastAuthUser) return null;

    const accessToken = (
      cookieStore.get(`CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.accessToken`)?.value ??
      cookieStore.get(`CognitoIdentityServiceProvider.${clientId}.${encodeURIComponent(lastAuthUser)}.accessToken`)?.value
    );
    if (!accessToken) return null;

    const payload = await verifyToken(accessToken);

    const groups = (payload["cognito:groups"] as string[] | undefined) ?? [];
    const sub   = payload.sub as string;
    const phoneNumber = payload.phone_number as string | undefined;
    const birthdate   = payload.birthdate as string | undefined;

    // The email must come from the verified id-token `email` claim: access
    // tokens carry no email, and for this pool `LastAuthUser` is the Cognito
    // sub (a UUID), not an address. Fall back to LastAuthUser only if it is
    // itself an email (pools where the username is the email).
    let email = lastAuthUser.includes("@") ? lastAuthUser : "";
    const idToken = (
      cookieStore.get(`CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.idToken`)?.value ??
      cookieStore.get(`CognitoIdentityServiceProvider.${clientId}.${encodeURIComponent(lastAuthUser)}.idToken`)?.value
    );
    if (idToken) {
      try {
        const idPayload = await verifyToken(idToken);
        if (typeof idPayload.email === "string" && idPayload.email) {
          email = idPayload.email;
        }
      } catch {
        // Keep the fallback if the id token can't be verified.
      }
    }

    return { sub, email, groups, phoneNumber, birthdate };
  } catch {
    return null;
  }
}

export async function getUserSession(): Promise<UserSession | null> {
  const cognitoSession = await getServerSession();
  if (!cognitoSession) return null;

  try {
    const existing = await prisma.user.findUnique({ where: { cognitoSub: cognitoSession.sub } });
    if (existing) {
      return { sub: existing.id, email: existing.email, name: existing.name, phoneNumber: cognitoSession.phoneNumber, birthdate: cognitoSession.birthdate };
    }

    if (cognitoSession.email) {
      const user = await prisma.user.upsert({
        where: { email: cognitoSession.email },
        update: { cognitoSub: cognitoSession.sub, email: cognitoSession.email },
        create: { cognitoSub: cognitoSession.sub, email: cognitoSession.email },
        select: { id: true, email: true, name: true },
      });
      return { sub: user.id, email: user.email, name: user.name, phoneNumber: cognitoSession.phoneNumber, birthdate: cognitoSession.birthdate };
    }

    const user = await prisma.user.create({
      data: { cognitoSub: cognitoSession.sub, email: cognitoSession.sub },
      select: { id: true, email: true, name: true },
    });
    return { sub: user.id, email: user.email, name: user.name, phoneNumber: cognitoSession.phoneNumber, birthdate: cognitoSession.birthdate };
  } catch {
    return null;
  }
}

const ACTIVE_ORG_COOKIE = "startline_active_org";

// Resolves the user's memberships to an active Organiser. If the user manages
// multiple organisers, the `startline_active_org` cookie (set by the org
// switcher) picks the active one; otherwise the OWNER membership wins.
export async function getOrganiserSession(): Promise<OrganiserSession | null> {
  const cognitoSession = await getServerSession();
  if (!cognitoSession) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { cognitoSub: cognitoSession.sub },
      include: {
        memberships: {
          include: {
            organiser: {
              select: { id: true, email: true, status: true, verified: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!user || user.memberships.length === 0) return null;

    let membership = user.memberships[0];
    if (user.memberships.length > 1) {
      const cookieStore = await cookies().catch(() => null);
      const activeId   = cookieStore?.get(ACTIVE_ORG_COOKIE)?.value;
      const fromCookie = user.memberships.find((m) => m.organiser.id === activeId);
      const superAdmin = user.memberships.find((m) => m.role === "OWNER");
      membership = fromCookie ?? superAdmin ?? user.memberships[0];
    }

    const organiser = membership.organiser;
    return {
      sub:      organiser.id,
      email:    organiser.email,
      status:   String(organiser.status),
      verified: organiser.verified,
      role:     membership.role,
    };
  } catch {
    return null;
  }
}

export async function getOrganiserMemberships(): Promise<OrganiserMembership[] | null> {
  const cognitoSession = await getServerSession();
  if (!cognitoSession) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { cognitoSub: cognitoSession.sub },
      select: {
        memberships: {
          select: {
            role:       true,
            organiser:  { select: { id: true, orgName: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!user) return null;

    return user.memberships.map((m) => ({
      organiserId:   m.organiser.id,
      organiserName: m.organiser.orgName,
      role:          m.role,
    }));
  } catch {
    return null;
  }
}

export async function getOrganiserRole(organiserId: string): Promise<OrganiserRole | null> {
  const cognitoSession = await getServerSession();
  if (!cognitoSession) return null;

  try {
    const membership = await prisma.organiserMember.findFirst({
      where: {
        organiserId,
        user: { cognitoSub: cognitoSession.sub },
      },
      select: { role: true },
    });
    return membership?.role ?? null;
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cognitoSession = await getServerSession();
  if (!cognitoSession) return null;
  if (!cognitoSession.groups.includes("admins")) return null;

  try {
    // Resolve by email first (unique): a dev/bypass identity can share the
    // seeded admin's email but carry a different cognitoSub, so upserting by
    // sub alone would try to create a duplicate email row and fail.
    const admin = await prisma.admin.findUnique({
      where:  { email: cognitoSession.email ?? "" },
      select: { id: true, email: true, name: true },
    });
    if (admin) return { sub: admin.id, email: admin.email, name: admin.name };

    const created = await prisma.admin.upsert({
      where:  { cognitoSub: cognitoSession.sub },
      update: cognitoSession.email ? { email: cognitoSession.email } : {},
      create: { cognitoSub: cognitoSession.sub, email: cognitoSession.email || cognitoSession.sub },
      select: { id: true, email: true, name: true },
    });
    return { sub: created.id, email: created.email, name: created.name };
  } catch {
    return null;
  }
}
