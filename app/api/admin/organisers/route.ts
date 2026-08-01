import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  try {
    const organisers = await prisma.organiser.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id:                       true,
        orgName:                  true,
        contactName:              true,
        email:                    true,
        phone:                    true,
        abn:                      true,
        status:                   true,
        verified:                 true,
        stripeOnboardingComplete: true,
        insuranceDeclared:        true,
        createdAt:                true,
        _count: {
          select: { events: true, reviews: true, registrations: true, members: true },
        },
        events: {
          where:  { status: "APPROVED" },
          select: { id: true },
        },
      },
    });

    const rows = organisers.map(({ events, _count, ...o }: { events: { id: string }[]; _count: { events: number; reviews: number; registrations: number; members: number } }) => ({
      ...o,
      eventCount:        _count.events,
      liveEventCount:    events.length,
      reviewCount:       _count.reviews,
      registrationCount: _count.registrations,
      memberCount:       _count.members,
    }));

    return NextResponse.json(rows);
  } catch (err) {
    console.error("Admin organisers fetch error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
