import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/amplify-server";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  if (session.groups.includes("admins")) {
    return NextResponse.json({ role: "admin", hasOrganiser: false, organiserCount: 0, memberships: [] });
  }

  const user = await prisma.user.findUnique({
    where:  { cognitoSub: session.sub },
    select: {
      memberships: {
        select: {
          role: true,
          organiser: { select: { id: true, orgName: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const memberships = (user?.memberships ?? []).map((m) => ({
    organiserId:   m.organiser.id,
    organiserName: m.organiser.orgName,
    role:          m.role,
  }));
  const organiserCount = memberships.length;

  return NextResponse.json({
    role: organiserCount > 0 ? "organiser" : "user",
    hasOrganiser: organiserCount > 0,
    organiserCount,
    memberships,
  });
}
