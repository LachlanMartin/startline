import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  if (!username) {
    return NextResponse.json({ error: "Username is required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where:  { username },
    select: {
      id: true, name: true, username: true, bio: true,
      profilePicUrl: true, isPublic: true, city: true, state: true, createdAt: true,
      registrations: {
        where: { status: "CONFIRMED" },
        select: {
          id: true, eventId: true,
          category: true,
          resultDistance: true, resultTime: true, resultPlacement: true,
          isPersonalBest: true, isTopResult: true,
          event: { select: { title: true, discipline: true, eventDate: true, city: true, state: true } },
        },
        orderBy: { event: { eventDate: "desc" } },
        take: 20,
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  if (!user.isPublic) {
    return NextResponse.json({ error: "This profile is private." }, { status: 403 });
  }

  return NextResponse.json(user);
}
