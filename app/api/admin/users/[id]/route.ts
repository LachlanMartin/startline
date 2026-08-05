import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { validateUsername } from "@/lib/username-validation";
import { writeAuditLog } from "@/lib/audit";
import {
  CognitoIdentityProviderClient,
  AdminUpdateUserAttributesCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const region     = process.env.NEXT_PUBLIC_AWS_REGION ?? "ap-southeast-2";
const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const client     = new CognitoIdentityProviderClient({ region });

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;

  try {
    const user = await prisma.user.findUnique({
      where:  { id },
      select: {
        id: true, email: true, name: true, username: true,
        bio: true, profilePicUrl: true, isPublic: true,
        city: true, state: true, isBanned: true,
        memberships: { select: { organiser: { select: { id: true, orgName: true, status: true } } } },
      },
    });
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

// PUT /api/admin/users/[id] — edit any user's profile.
// Body fields (all optional): name, username, bio, profilePicUrl, isPublic,
// city, state, email. Email changes are synced to Cognito so the user can
// still sign in with the new address.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  const changed: string[] = [];

  const existing = await prisma.user.findUnique({
    where:  { id },
    select: { id: true, email: true, username: true },
  });
  if (!existing) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if ("name" in body) {
    data.name = body.name?.trim() || null;
    changed.push("name");
  }

  if ("username" in body) {
    const username = body.username?.trim()?.toLowerCase();
    if (username) {
      const validation = validateUsername(username);
      if (!validation.valid) return badRequest(validation.reason);

      const taken = await prisma.user.findUnique({ where: { username } });
      if (taken && taken.id !== id) return badRequest("This username is already taken.");
    }
    data.username = username || null;
    changed.push("username");
  }

  if ("email" in body) {
    const email = body.email?.trim()?.toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return badRequest("A valid email is required.");
    }
    if (email !== existing.email) {
      const taken = await prisma.user.findUnique({ where: { email } });
      if (taken && taken.id !== id) return badRequest("This email is already in use.");

      // Syncing email to Cognito must succeed before we touch the DB, otherwise
      // the account would be broken (Cognito still on the old address).
      try {
        await client.send(new AdminUpdateUserAttributesCommand({
          UserPoolId: userPoolId,
          Username: existing.email,
          UserAttributes: [
            { Name: "email", Value: email },
            { Name: "email_verified", Value: "true" },
          ],
        }));
      } catch (err) {
        console.error("Cognito email update failed:", err);
        return NextResponse.json(
          { error: "Could not update the email in the auth provider. The user may not have a matching login account." },
          { status: 409 },
        );
      }
    }
    data.email = email;
    changed.push("email");
  }

  if ("bio" in body) { data.bio = body.bio?.trim() || null; changed.push("bio"); }
  if ("profilePicUrl" in body) { data.profilePicUrl = body.profilePicUrl || null; changed.push("profilePicUrl"); }
  if ("isPublic" in body) { data.isPublic = body.isPublic; changed.push("isPublic"); }
  if ("city" in body) { data.city = body.city?.trim() || null; changed.push("city"); }
  if ("state" in body) { data.state = body.state?.trim() || null; changed.push("state"); }

  try {
    await prisma.user.update({ where: { id }, data });

    writeAuditLog({
      adminId: session.sub,
      action: "EDIT_USER",
      targetType: "user",
      targetId: id,
      meta: { email: existing.email, fields: changed },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin user update error:", err);
    return NextResponse.json({ error: "Failed to update user." }, { status: 500 });
  }
}
