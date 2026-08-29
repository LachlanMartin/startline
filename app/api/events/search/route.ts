import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { EVENT_TYPE_OPTIONS } from "@/types";

export const dynamic = "force-dynamic";

const MAX_RESULTS = 8;
/** Divisions shown under one discipline before the list gets unwieldy. */
const MAX_DIVISIONS = 5;

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

  const lower = q.toLowerCase();

  // Disciplines are a fixed list, so they are matched here rather than queried.
  const matchedTypes = EVENT_TYPE_OPTIONS.filter((o) =>
    o.label.toLowerCase().includes(lower) ||
    o.shortLabel.toLowerCase().includes(lower) ||
    o.value.toLowerCase().includes(lower));

  // Divisions ("5K", "Half Marathon", …) are free text the organiser enters per
  // event and land in a Json column, which Prisma cannot group by, so they are
  // tallied in memory. Events are pulled for the matched disciplines and,
  // separately, for a direct division match so typing "half mara" finds it
  // without naming the discipline.
  const divisionSource = await prisma.event.findMany({
    where: {
      status: "APPROVED",
      ...(matchedTypes.length
        ? {}
        : { discipline: { in: EVENT_TYPE_OPTIONS.map((o) => o.value) } }),
    },
    select: { discipline: true, categories: true },
  });

  const tally = new Map<string, Map<string, number>>();
  const eventCountByDiscipline = new Map<string, number>();

  for (const e of divisionSource) {
    eventCountByDiscipline.set(e.discipline, (eventCountByDiscipline.get(e.discipline) ?? 0) + 1);
    const divisions = Array.isArray(e.categories) ? e.categories : [];
    let byDivision = tally.get(e.discipline);
    if (!byDivision) { byDivision = new Map(); tally.set(e.discipline, byDivision); }
    for (const d of divisions) {
      if (typeof d !== "string" || !d.trim()) continue;
      byDivision.set(d, (byDivision.get(d) ?? 0) + 1);
    }
  }

  const divisionsFor = (discipline: string, onlyMatching: boolean) =>
    [...(tally.get(discipline) ?? new Map<string, number>())]
      .filter(([name]) => !onlyMatching || name.toLowerCase().includes(lower))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, MAX_DIVISIONS)
      .map(([name, count]) => ({
        name,
        eventCount: count,
        href: `/events?type=${discipline}&division=${encodeURIComponent(name)}`,
      }));

  // A discipline match lists its most common divisions; otherwise only the
  // divisions that match the text are offered. Anything holding no events is
  // dropped, since suggesting it would lead to an empty listing.
  const categories = (matchedTypes.length
    ? matchedTypes.map((o) => ({ option: o, divisions: divisionsFor(o.value, false) }))
    : EVENT_TYPE_OPTIONS
        .map((o) => ({ option: o, divisions: divisionsFor(o.value, true) }))
        .filter((c) => c.divisions.length > 0))
    .map(({ option, divisions }) => ({
      value: option.value,
      label: option.shortLabel,
      href: `/events?type=${option.value}`,
      eventCount: eventCountByDiscipline.get(option.value) ?? 0,
      divisions,
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
