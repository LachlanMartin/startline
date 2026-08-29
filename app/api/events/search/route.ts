import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { EVENT_TYPE_OPTIONS } from "@/types";

export const dynamic = "force-dynamic";

const MAX_RESULTS = 8;

const searchQuery = z.object({
  q: z.string().trim().min(2).max(100),
});

/**
 * Typeahead suggestions for the search bars' event field.
 *
 * Deliberately narrow: it returns only what the dropdown renders, rather than
 * reusing `getAllEvents`, which pulls every approved event with its full
 * payload. Matching mirrors the client-side `filterEvents` search in
 * `lib/utils.ts` (title, location, city, organiser) so the suggestions and the
 * filtered listing agree on what counts as a match.
 */
export async function GET(req: NextRequest) {
  const parsed = searchQuery.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ categories: [], results: [] });
  }

  const q = parsed.data.q;

  // Categories are a fixed list, so they are matched here rather than queried.
  // Counts come from one groupBy so a category can show how much it holds, and
  // categories with nothing in them are dropped — suggesting one would lead to
  // an empty listing.
  const matchedTypes = EVENT_TYPE_OPTIONS.filter((o) =>
    o.label.toLowerCase().includes(q.toLowerCase()) ||
    o.shortLabel.toLowerCase().includes(q.toLowerCase()) ||
    o.value.toLowerCase().includes(q.toLowerCase()));

  const counts = matchedTypes.length
    ? await prisma.event.groupBy({
        by: ["discipline"],
        where: {
          status: "APPROVED",
          discipline: { in: matchedTypes.map((o) => o.value) },
        },
        _count: { _all: true },
      })
    : [];

  const countByDiscipline = new Map(counts.map((c) => [c.discipline, c._count._all]));

  const categories = matchedTypes
    .map((o) => ({
      value: o.value,
      label: o.shortLabel,
      href: `/events?type=${o.value}`,
      eventCount: countByDiscipline.get(o.value) ?? 0,
    }))
    .filter((c) => c.eventCount > 0);

  const events = await prisma.event.findMany({
    where: {
      status: "APPROVED",
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { venue: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { organiser: { is: { orgName: { contains: q, mode: "insensitive" } } } },
      ],
    },
    orderBy: { eventDate: "asc" },
    take: MAX_RESULTS,
    select: {
      id: true,
      slug: true,
      title: true,
      city: true,
      state: true,
      discipline: true,
      eventDate: true,
    },
  });

  return NextResponse.json({
    categories,
    results: events.map((e) => ({
      id: e.id,
      // Prefer the readable slug; the id route still resolves for older events
      // that predate slugs.
      href: `/events/${e.slug ?? e.id}`,
      title: e.title,
      city: e.city,
      state: e.state,
      discipline: e.discipline,
      eventDate: e.eventDate,
    })),
  });
}
