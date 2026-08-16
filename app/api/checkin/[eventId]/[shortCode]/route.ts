import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { checkinParams } from "@/lib/schemas";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string; shortCode: string }> },
) {
  const parsed = checkinParams.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Invalid check-in link." }, { status: 400 });
  const { eventId, shortCode } = parsed.data;

  // The shortCode is the event's unguessable check-in code. Resolving by it
  // (not eventId alone) means a mistyped or fabricated link gets a 404.
  const event = await prisma.event.findFirst({
    where: { id: eventId, checkInCode: shortCode, status: "APPROVED" },
    select: {
      title: true, eventDate: true, startTime: true,
      venue: true, city: true, state: true,
    },
  });
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  // Match the signed-in athlete to their registration by verified email first
  // (precise — covers group bookings where a buyer registered others), then by
  // userId for guests whose email differs.
  const registration = await prisma.registration.findFirst({
    where: {
      eventId,
      status: "CONFIRMED",
      OR: [
        { athleteEmail: { equals: session.email, mode: "insensitive" } },
        { userId: session.sub },
      ],
    },
    select: {
      athleteName: true, waveLabel: true, bibNumber: true,
      checkedInAt: true,
    },
  });

  return NextResponse.json({
    event,
    registration: registration ?? null,
  });
}
