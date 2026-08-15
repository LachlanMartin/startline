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
import { idParams } from "@/lib/schemas";

async function assertPublicOrganiser(id: string) {
  return prisma.organiser.findFirst({
    where: { id, status: "APPROVED" },
    select: { id: true },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Organiser not found." }, { status: 404 });
  }
  const { id } = parsedParams.data;
  const organiser = await assertPublicOrganiser(id);
  if (!organiser) {
    return NextResponse.json({ error: "Organiser not found." }, { status: 404 });
  }

  const session = await getUserSession();
  const [stats, following, isOwnProfile] = await Promise.all([
    getOrganiserPublicStats(id),
    session ? isFollowingOrganiser(session.sub, id) : Promise.resolve(false),
    session
      ? prisma.organiserMember
          .findFirst({ where: { organiserId: id, userId: session.sub }, select: { id: true } })
          .then((m) => !!m)
      : Promise.resolve(false),
  ]);

  return NextResponse.json({
    ...stats,
    following,
    isOwnProfile,
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

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Organiser not found." }, { status: 404 });
  }
  const { id } = parsedParams.data;
  const organiser = await assertPublicOrganiser(id);
  if (!organiser) {
    return NextResponse.json({ error: "Organiser not found." }, { status: 404 });
  }

  const ownMembership = await prisma.organiserMember.findFirst({
    where: { organiserId: id, userId: session.sub },
    select: { id: true },
  });
  if (ownMembership) {
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

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Organiser not found." }, { status: 404 });
  }
  const { id } = parsedParams.data;
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
