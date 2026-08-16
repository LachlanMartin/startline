import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { z } from "zod";

const eventIdParams = z.object({ eventId: z.string().min(1).max(255) });

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsed = eventIdParams.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  const { eventId } = parsed.data;

  const registration = await prisma.registration.findFirst({
    where: {
      eventId,
      status: "CONFIRMED",
      OR: [
        { athleteEmail: { equals: session.email, mode: "insensitive" } },
        { userId: session.sub },
      ],
    },
    select: { id: true, checkedInAt: true },
  });
  if (!registration) {
    return NextResponse.json({ error: "You are not registered for this event." }, { status: 404 });
  }

  // Idempotent — only set the timestamp if not already checked in.
  const checkedInAt = registration.checkedInAt
    ?? (await prisma.registration.update({
      where: { id: registration.id },
      data: { checkedInAt: new Date() },
      select: { checkedInAt: true },
    })).checkedInAt;

  return NextResponse.json({ checkedInAt });
}
