import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/amplify-server";
import { pickActiveMembership } from "@/lib/active-organiser";

export const dynamic = "force-dynamic";

const ACTIVE_ORG_COOKIE = "startline_active_org";

// GET /api/organiser/memberships
// Returns all organisers the current user manages + the active one (cookie).
export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
      where: { cognitoSub: session.sub },
      select: {
        memberships: {
          select: {
            role: true,
            organiser: { select: { id: true, orgName: true, status: true, logoUrl: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!user) return NextResponse.json({ memberships: [], activeOrganiserId: null });

    const cookieStore = await cookies();
    const activeId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
    const memberships = user.memberships.map((m) => ({
      organiserId:   m.organiser.id,
      organiserName: m.organiser.orgName,
      role:          m.role,
      status:        m.organiser.status,
      logoUrl:       m.organiser.logoUrl,
    }));

    const activeOrganiserId =
      pickActiveMembership(memberships, activeId)?.organiserId ?? null;

    return NextResponse.json({ memberships, activeOrganiserId });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
