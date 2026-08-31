import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import {
  daysUntil,
  describeTiers,
  parseTiers,
  refundAmountCents,
  refundPercentFor,
} from "@/lib/refund-policy";

/** GET — confirmed registrations for the signed-in athlete (wave + bib for Activity). */
export async function GET() {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const registrations = await prisma.registration.findMany({
    where: {
      // Show live entries plus any with a refund in flight, so the athlete can see
      // the pending state rather than having the card vanish on request.
      status: { in: ["CONFIRMED", "REFUND_REQUESTED", "REFUNDED"] },
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
      // Money and policy, so Activity can quote the refund before the athlete
      // commits rather than asking them to request one blind.
      amountCents: true,
      platformFeeCents: true,
      refundPercent: true,
      refundAmountCents: true,
      refundOutsidePolicy: true,
      event: {
        select: {
          id: true,
          title: true,
          discipline: true,
          eventDate: true,
          city: true,
          state: true,
          coverImageUrl: true,
          refundTiers: true,
        },
      },
    },
    take: 50,
  });

  const today = new Date().toISOString().slice(0, 10);

  return NextResponse.json({
    registrations: registrations.map((r) => {
      const paidCents = r.amountCents + r.platformFeeCents;
      const tiers = parseTiers(r.event.refundTiers);
      const days = daysUntil(r.event.eventDate, today);
      return {
        id: r.id,
        eventId: r.eventId,
        status: r.status,
        wave: r.startWaveLabel,
        bibNumber: r.bibNumber,
        paidCents,
        // Once a refund is in flight the frozen snapshot wins, so the athlete is
        // never shown a different number than the one they agreed to.
        refundAmountCents: r.refundAmountCents ?? refundAmountCents(tiers, paidCents, days),
        refundPercent: r.refundPercent ?? refundPercentFor(tiers, days),
        outsidePolicy: r.refundOutsidePolicy,
        policyLines: describeTiers(tiers),
        daysUntilEvent: days,
        event: r.event,
      };
    }),
  });
}
