import { NextRequest, NextResponse } from "next/server";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { archivePastEvents } from "@/lib/archive-events";
import {
  buildTrendDays,
  computeCurrentStats,
} from "@/lib/organiser-dashboard";

export async function GET(req: NextRequest) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  await archivePastEvents();

  const eventId = req.nextUrl.searchParams.get("eventId")?.trim() || null;
  const daysParam = Number(req.nextUrl.searchParams.get("days") ?? "30");
  const ALLOWED_DAYS = new Set([7, 30, 90, 365]);
  const rangeDays = ALLOWED_DAYS.has(daysParam) ? daysParam : 30;

  try {
    const [events, allConfirmed, followRows] = await Promise.all([
      prisma.event.findMany({
        where: { organiserId: session.sub },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          discipline: true,
          city: true,
          state: true,
          eventDate: true,
          startTime: true,
          status: true,
          cap: true,
          coverImageUrl: true,
          waves: true,
          registrationUrl: true,
        },
      }),
      prisma.registration.findMany({
        where: {
          organiserId: session.sub,
          status: "CONFIRMED",
        },
        select: {
          eventId: true,
          amountCents: true,
          platformFeeCents: true,
          createdAt: true,
        },
      }),
      prisma.organiserFollow.findMany({
        where: { organiserId: session.sub },
        select: { createdAt: true },
      }),
    ]);

    const followers = followRows.length;

    if (eventId && !events.some((e) => e.id === eventId)) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const confirmedByEvent = new Map<string, number>();
    let allTimeRevenueCents = 0;
    for (const r of allConfirmed) {
      confirmedByEvent.set(r.eventId, (confirmedByEvent.get(r.eventId) ?? 0) + 1);
      allTimeRevenueCents += Math.max(0, r.amountCents - r.platformFeeCents);
    }

    const eventInputs = events.map((e) => ({
      id: e.id,
      status: e.status,
      eventDate: e.eventDate,
      cap: e.cap,
    }));

    const current = computeCurrentStats(eventInputs, confirmedByEvent);
    const allTime = {
      registrations: allConfirmed.length,
      revenueCents: allTimeRevenueCents,
      followers,
      events: events.length,
    };

    const eventsOut = events.map((e) => ({
      id: e.id,
      title: e.title,
      discipline: e.discipline,
      city: e.city,
      state: e.state,
      eventDate: e.eventDate,
      startTime: e.startTime,
      status: e.status,
      cap: e.cap,
      coverImageUrl: e.coverImageUrl,
      waves: e.waves,
      registrationUrl: e.registrationUrl,
      registrationCount: confirmedByEvent.get(e.id) ?? 0,
    }));

    const trendSource = eventId
      ? allConfirmed.filter((r) => r.eventId === eventId)
      : allConfirmed;

    const since = new Date();
    since.setDate(since.getDate() - (rangeDays - 1));
    since.setHours(0, 0, 0, 0);
    const recentRegs = trendSource.filter((r) => r.createdAt >= since);
    const recentFollows = followRows
      .map((f) => f.createdAt)
      .filter((createdAt) => createdAt >= since);

    return NextResponse.json({
      current,
      allTime,
      events: eventsOut,
      trend: {
        days: buildTrendDays(recentRegs, rangeDays, new Date(), recentFollows),
        rangeDays,
      },
    });
  } catch (error) {
    console.error("Organiser dashboard error:", error);
    return NextResponse.json({ error: "Could not load dashboard." }, { status: 500 });
  }
}
