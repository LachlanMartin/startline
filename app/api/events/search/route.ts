import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";

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
    return NextResponse.json({ results: [] });
  }

  const q = parsed.data.q;

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
