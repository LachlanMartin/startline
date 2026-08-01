import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";

export async function GET() {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const follows = await prisma.organiserFollow.findMany({
    where: { userId: session.sub },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      organiser: {
        select: {
          id: true,
          orgName: true,
          logoUrl: true,
          _count: {
            select: { follows: true, events: true, registrations: true },
          },
        },
      },
    },
  });

  return NextResponse.json({
    organisers: follows.map((f) => ({
      followId: f.id,
      followedAt: f.createdAt,
      id: f.organiser.id,
      orgName: f.organiser.orgName,
      logoUrl: f.organiser.logoUrl,
      followers: f.organiser._count.follows,
      eventsHosted: f.organiser._count.events,
      registrations: f.organiser._count.registrations,
    })),
  });
}
