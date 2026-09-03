import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { requireOrganiser } from "@/lib/organiser-api-auth";

// POST /api/organiser/members/leave
// Removes the current user from the active organiser. The Owner cannot leave
// while they are the only Owner (transfer ownership first).
export async function POST(_req: NextRequest) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  const userSession = await getUserSession();
  if (!userSession) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  try {
    const membership = await prisma.organiserMember.findFirst({
      where:  { organiserId: session.sub, userId: userSession.sub },
      select: { id: true, role: true },
    });
    if (!membership) {
      return NextResponse.json({ error: "You are not a member of this organiser." }, { status: 404 });
    }

    if (membership.role === "OWNER") {
      const ownerCount = await prisma.organiserMember.count({
        where: { organiserId: session.sub, role: "OWNER" },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: "You are the only Owner. Transfer ownership before leaving." },
          { status: 400 }
        );
      }
    }

    await prisma.organiserMember.delete({ where: { id: membership.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
