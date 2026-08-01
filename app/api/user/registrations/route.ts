import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";

/** GET — confirmed registrations for the signed-in athlete (wave + bib for Activity). */
export async function GET() {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const registrations = await prisma.registration.findMany({
    where: {
      // Show live entries plus any with a refund in flight, so the athlete can see
      // the pending state rather than having the card vanish on request.
      status: { in: ["CONFIRMED", "REFUND_REQUESTED"] },
      OR: [
        { userId: session.sub },
        { athleteEmail: { equals: session.email, mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      eventId: true,
      status: true,
      startWaveLabel: true,
      bibNumber: true,
      event: {
        select: {
          id: true,
          title: true,
          discipline: true,
          eventDate: true,
          city: true,
          state: true,
          coverImageUrl: true,
        },
      },
    },
    take: 50,
  });

  return NextResponse.json({
    registrations: registrations.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      status: r.status,
      wave: r.startWaveLabel,
      bibNumber: r.bibNumber,
      event: r.event,
    })),
  });
}
