import prisma from "@/lib/prisma";
import { archivePastEvents } from "@/lib/archive-events";
import { getOrganiserRatings } from "@/lib/reviews";
import { lowestPrice, type PublicEvent, type PublicWave } from "./event-types";

export async function getAllEvents() {
  try {
    await archivePastEvents();
    const events = await prisma.event.findMany({
      where: { status: "APPROVED" },
      orderBy: { eventDate: "asc" },
      select: {
        id: true,
        title: true,
        discipline: true,
        tagline: true,
        description: true,
        eventDate: true,
        endDate: true,
        startTime: true,
        endTime: true,
        venue: true,
        address: true,
        city: true,
        state: true,
        format: true,
        level: true,
        categories: true,
        cap: true,
        minAge: true,
        waves: true,
        extras: true,
        refundPolicy: true,
        coverImageUrl: true,
        photos: true,
        registrationType: true,
        registrationUrl: true,
        feeStructure: true,
        organiserId: true,
        organiser: {
          select: { id: true, orgName: true, logoUrl: true, stripeAccountId: true, stripeOnboardingComplete: true },
        },
        _count: {
          select: { registrations: true },
        },
      },
    });

    const ratings = await getOrganiserRatings(events.map((e) => e.organiserId));

    // ponytail: `any` avoids Prisma type dependency; `pnpm build` verifies correctness
    return events.map((e: any) => ({
      ...e,
      fromPrice: lowestPrice(e.waves),
      registrationCount: e._count.registrations,
      organiser: e.organiser
        ? { ...e.organiser, rating: ratings.get(e.organiserId) ?? null }
        : e.organiser,
    }));
  } catch {
    return [];
  }
}

const publicEventSelect = {
  id: true,
  title: true,
  discipline: true,
  tagline: true,
  description: true,
  eventDate: true,
  endDate: true,
  startTime: true,
  endTime: true,
  venue: true,
  address: true,
  city: true,
  state: true,
  format: true,
  level: true,
  categories: true,
  cap: true,
  minAge: true,
  waves: true,
  extras: true,
  refundPolicy: true,
  coverImageUrl: true,
  photos: true,
  registrationType: true,
  registrationUrl: true,
  feeStructure: true,
  organiserId: true,
  organiser: {
    select: { id: true, orgName: true, logoUrl: true, stripeAccountId: true, stripeOnboardingComplete: true },
  },
  _count: {
    select: { registrations: true },
  },
} as const;

/** Single public event by id — live or archived (past) listings. */
export async function getPublicEventById(id: string): Promise<PublicEvent | null> {
  try {
    const event = await prisma.event.findFirst({
      where: {
        id,
        status: { in: ["APPROVED", "ARCHIVED"] },
      },
      select: publicEventSelect,
    });
    if (!event) return null;

    const ratings = await getOrganiserRatings([event.organiserId]);
    return {
      ...event,
      fromPrice: lowestPrice(event.waves),
      registrationCount: event._count.registrations,
      organiser: event.organiser
        ? { ...event.organiser, rating: ratings.get(event.organiserId) ?? null }
        : event.organiser,
    } as PublicEvent;
  } catch {
    return null;
  }
}

/** Archived (past) events for an organiser profile carousel — most recent first. */
export async function getOrganiserPastEvents(organiserId: string, limit = 20): Promise<PublicEvent[]> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const events = await prisma.event.findMany({
      where: {
        organiserId,
        OR: [
          { status: "ARCHIVED" },
          {
            status: "APPROVED",
            OR: [
              { endDate: { not: null, lt: today } },
              { endDate: null, eventDate: { lt: today } },
            ],
          },
        ],
      },
      orderBy: { eventDate: "desc" },
      take: limit,
      select: publicEventSelect,
    });

    const ratings = await getOrganiserRatings([organiserId]);
    const rating = ratings.get(organiserId) ?? null;

    return events.map((e: any) => ({
      ...e,
      fromPrice: lowestPrice(e.waves),
      registrationCount: e._count.registrations,
      organiser: e.organiser
        ? { ...e.organiser, rating }
        : e.organiser,
    }));
  } catch {
    return [];
  }
}
