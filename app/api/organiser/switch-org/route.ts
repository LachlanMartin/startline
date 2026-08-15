import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/amplify-server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ACTIVE_ORG_COOKIE = "startline_active_org";

const switchOrgSchema = z.object({ organiserId: z.string().min(1).max(255) });

// POST /api/organiser/switch-org
// Body: { organiserId } — validates the user is a member, sets the active-org cookie.
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  let organiserId = "";
  try {
    const parsed = switchOrgSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    organiserId = parsed.data.organiserId;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const membership = await prisma.organiserMember.findFirst({
      where: { organiserId, user: { cognitoSub: session.sub } },
      select: { id: true },
    });
    if (!membership) {
      return NextResponse.json({ error: "Not a member of that organiser." }, { status: 403 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(ACTIVE_ORG_COOKIE, organiserId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
