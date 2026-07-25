import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import {
  followOrganiser,
  getOrganiserPublicStats,
  isFollowingOrganiser,
  unfollowOrganiser,
} from "@/lib/organiser-follows";

async function assertPublicOrganiser(id: string) {
  return prisma.organiser.findFirst({
    where: { id, status: "APPROVED" },
    select: { id: true, userId: true },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const organiser = await assertPublicOrganiser(id);
  if (!organiser) {
    return NextResponse.json({ error: "Organiser not found." }, { status: 404 });
  }

  const session = await getUserSession();
  const [stats, following] = await Promise.all([
    getOrganiserPublicStats(id),
    session ? isFollowingOrganiser(session.sub, id) : Promise.resolve(false),
  ]);

  return NextResponse.json({
    ...stats,
    following,
    isOwnProfile: Boolean(session && session.sub === organiser.userId),
  });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const { id } = await params;
  const organiser = await assertPublicOrganiser(id);
  if (!organiser) {
    return NextResponse.json({ error: "Organiser not found." }, { status: 404 });
  }

  if (organiser.userId === session.sub) {
    return NextResponse.json({ error: "You cannot follow your own organiser profile." }, { status: 400 });
  }

  try {
    await followOrganiser(session.sub, id);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Already following — treat as success
    } else {
      console.error("Follow create error:", err);
      return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
    }
  }

  const stats = await getOrganiserPublicStats(id);
  return NextResponse.json({ following: true, ...stats });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const { id } = await params;
  const organiser = await assertPublicOrganiser(id);
  if (!organiser) {
    return NextResponse.json({ error: "Organiser not found." }, { status: 404 });
  }

  try {
    await unfollowOrganiser(session.sub, id);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      // Not following — treat as success
    } else {
      console.error("Follow delete error:", err);
      return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
    }
  }

  const stats = await getOrganiserPublicStats(id);
  return NextResponse.json({ following: false, ...stats });
}
