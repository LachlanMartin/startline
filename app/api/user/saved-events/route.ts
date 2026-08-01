import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";

export async function GET() {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const saved = await prisma.savedEvent.findMany({
    where: { userId: session.sub },
    select: { eventId: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ eventIds: saved.map((s) => s.eventId) });
}

export async function POST(req: Request) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const body = await req.json();
  const eventId = typeof body?.eventId === "string" ? body.eventId : null;
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  try {
    await prisma.savedEvent.create({ data: { userId: session.sub, eventId } });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
  }

  return NextResponse.json({ saved: true });
}

export async function DELETE(req: Request) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const body = await req.json();
  const eventId = typeof body?.eventId === "string" ? body.eventId : null;
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  try {
    await prisma.savedEvent.delete({
      where: { userId_eventId: { userId: session.sub, eventId } },
    });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")) throw err;
  }

  return NextResponse.json({ saved: false });
}
