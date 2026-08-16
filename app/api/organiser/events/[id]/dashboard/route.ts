import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrganiserSession } from "@/lib/amplify-server";
import { archivePastEvents } from "@/lib/archive-events";
import { PLATFORM_FEE_PERCENT, PLATFORM_FEE_FIXED_CENTS } from "@/lib/platform-fee";
import { idParams } from "@/lib/schemas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  try {
    await archivePastEvents();
    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event)                            return NextResponse.json({ error: "Not found." },  { status: 404 });
    if (event.organiserId !== session.sub) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (event.status !== "APPROVED")       return NextResponse.json({ error: "Dashboard only available for live events." }, { status: 409 });

    const waves = (event.waves as { label: string; price: string; qty?: number }[]) ?? [];
    const lowestPrice = waves.length
      ? Math.min(...waves.map(w => parseFloat(w.price || "0")))
      : 0;

    // Prefer real registration data when it exists, fall back to the estimate.
    const [registrations, registrationCount, checkedInCount] = await Promise.all([
      prisma.registration.findMany({
        where:   { eventId: id, status: "CONFIRMED" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true, athleteName: true, athleteEmail: true, category: true,
          waveLabel: true, gender: true, medicalNotes: true, checkedInAt: true,
          amountCents: true, platformFeeCents: true, createdAt: true,
        },
      }),
      prisma.registration.count({ where: { eventId: id, status: "CONFIRMED" } }),
      prisma.registration.count({ where: { eventId: id, status: "CONFIRMED", checkedInAt: { not: null } } }),
    ]);

    const soldByWave: Record<string, number> = {};
    for (const r of registrations) {
      if (r.waveLabel) soldByWave[r.waveLabel] = (soldByWave[r.waveLabel] ?? 0) + 1;
    }
    const wavesWithSold = waves.map(w => ({ ...w, sold: soldByWave[w.label] ?? 0 }));

    const count = registrationCount;
    const hasRealData = count > 0;

    let gross: number;
    let fees: number;
    if (hasRealData) {
      gross = registrations.reduce((sum: number, r: { amountCents: number; platformFeeCents: number }) => sum + r.amountCents, 0) / 100;
      fees  = registrations.reduce((sum: number, r: { amountCents: number; platformFeeCents: number }) => sum + r.platformFeeCents, 0) / 100;
    } else {
      gross = lowestPrice * count;
      fees  = count > 0 ? (gross * PLATFORM_FEE_PERCENT) + (count * PLATFORM_FEE_FIXED_CENTS / 100) : 0;
    }
    const netPayout = Math.max(0, gross - fees);

    const recentRegistrations = registrations.slice(0, 20).map((r: { id: string; athleteName: string | null; athleteEmail: string | null; category: string | null; waveLabel: string | null; gender: string | null; medicalNotes: string | null; checkedInAt: Date | null; amountCents: number; platformFeeCents: number; createdAt: Date }) => ({
      id:           r.id,
      name:         r.athleteName,
      email:        r.athleteEmail,
      category:     r.category,
      wave:         r.waveLabel,
      gender:       r.gender,
      medicalNotes: r.medicalNotes,
      checkedInAt:  r.checkedInAt,
      amount:       r.amountCents / 100,
      createdAt:    r.createdAt,
    }));

    const announcements = await prisma.announcement.findMany({
      where:   { eventId: id },
      orderBy: { createdAt: "desc" },
      select:  { id: true, title: true, body: true, createdAt: true },
    });

    return NextResponse.json({
      event: {
        id:                event.id,
        title:             event.title,
        discipline:        event.discipline,
        eventDate:         event.eventDate,
        endDate:           event.endDate,
        startTime:         event.startTime,
        endTime:           event.endTime,
        venue:             event.venue,
        city:              event.city,
        state:             event.state,
        cap:               event.cap,
        registrationCount: count,
        checkedInCount,
        checkInCode:       event.checkInCode,
        coverImageUrl:     event.coverImageUrl,
        waves: wavesWithSold,
        feeStructure:      event.feeStructure,
        categories:        event.categories,
      },
      payout: {
        registrationCount: count,
        lowestTicketPrice: lowestPrice,
        grossRevenue:      gross,
        platformFees:      fees,
        estimatedPayout:   netPayout,
        feeStructure:      event.feeStructure, // "athlete" | "organiser"
        isEstimate:        !hasRealData,
        note: hasRealData
          ? "Based on confirmed registrations."
          : "Estimate based on lowest ticket price × registration count. Actual amounts depend on ticket tier mix.",
      },
      recentRegistrations,
      announcements,
    });
  } catch (err) {
    console.error("Dashboard API error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
