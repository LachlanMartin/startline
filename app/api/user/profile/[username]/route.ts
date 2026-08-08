import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrganiserRatings } from "@/lib/reviews";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  if (!username) {
    return NextResponse.json({ error: "Username is required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      bio: true,
      profilePicUrl: true,
      coverImageUrl: true,
      coverPosition: true,
      isPublic: true,
      city: true,
      state: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  if (!user.isPublic) {
    return NextResponse.json({ error: "This profile is private." }, { status: 403 });
  }

  const registrations = await prisma.registration.findMany({
    where: { userId: user.id, status: "CONFIRMED" },
    orderBy: { event: { eventDate: "asc" } },
    select: {
      id: true,
      finishTime: true,
      result: true,
      event: {
        select: {
          id: true,
          title: true,
          discipline: true,
          eventDate: true,
          city: true,
          state: true,
          coverImageUrl: true,
          organiser: { select: { id: true, orgName: true, logoUrl: true } },
        },
      },
    },
  });

  const ratings = await getOrganiserRatings(
    registrations.map((r) => r.event.organiser.id),
  );
  const historyRegistrations = registrations.map((r) => ({
    ...r,
    event: {
      ...r.event,
      organiser: {
        ...r.event.organiser,
        rating: ratings.get(r.event.organiser.id) ?? null,
      },
    },
  }));

  return NextResponse.json({
    ...user,
    history: {
      completed: registrations.length,
      registrations: historyRegistrations,
    },
  });
}
