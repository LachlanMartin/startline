import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { z } from "zod";

const savedEventSchema = z.object({ eventId: z.string().min(1).max(255) });

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

  const parsed = savedEventSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }
  const eventId = parsed.data.eventId;

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

  const parsed = savedEventSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }
  const eventId = parsed.data.eventId;

  try {
    await prisma.savedEvent.delete({
      where: { userId_eventId: { userId: session.sub, eventId } },
    });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")) throw err;
  }

  return NextResponse.json({ saved: false });
}
