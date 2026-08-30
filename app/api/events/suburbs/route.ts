import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { geocodePlace } from "@/lib/geocode";
import { haversineDistance } from "@/lib/distance";
import { getEventCoords } from "@/lib/australia-coords";

export const dynamic = "force-dynamic";

const MAX_RESULTS = 8;
/** Beyond this a "nearby" suggestion stops being a useful alternative. */
const NEARBY_RADIUS_KM = 250;

const suburbQuery = z.object({
  q: z.string().trim().min(2).max(100),
  // The event field's current selection. Suggestions are counted against it so
  // a suburb is never offered, or counted, for events the listing would then
  // filter out.
  type: z.string().trim().max(40).optional(),
  division: z.string().trim().max(60).optional(),
});

export interface SuburbSuggestion {
  city: string;
  state: string;
  eventCount: number;
  /**
   * Set when the query matched a venue rather than the city, e.g. "Bondi"
   * matching Bondi Beach in Sydney. The listing's where filter already matches
   * on venue, so selecting it narrows correctly.
   */
  venue?: string;
  /** Set only on nearby fallback results, in km from the searched place. */
  distanceKm?: number;
}

interface SuburbRow {
  city: string;
  state: string;
  count: number;
  lat: number | null;
  lng: number | null;
  /** Venue names hosting events in this suburb, with their own counts. */
  venues: Map<string, number>;
}

/**
 * Collapse approved events down to the distinct suburbs that actually host
 * them, with a representative coordinate for each.
 */
async function loadEventSuburbs(filter: { type?: string; division?: string }): Promise<SuburbRow[]> {
  const events = await prisma.event.findMany({
    where: {
      status: "APPROVED",
      ...(filter.type ? { discipline: filter.type } : {}),
    },
    select: { city: true, state: true, venue: true, categories: true, latitude: true, longitude: true },
  });

  const byKey = new Map<string, SuburbRow>();
  for (const e of events) {
    if (!e.city) continue;
    // Divisions live in a Json column, so the division filter is applied here
    // rather than in the query.
    if (filter.division) {
      const divisions = Array.isArray(e.categories) ? e.categories : [];
      if (!divisions.some((d) => typeof d === "string" && d === filter.division)) continue;
    }
    const key = `${e.city.toLowerCase()}|${e.state}`;
    const existing = byKey.get(key);
    const row = existing ?? {
      city: e.city, state: e.state, count: 0,
      lat: e.latitude, lng: e.longitude,
      venues: new Map<string, number>(),
    };
    row.count += 1;
    if (row.lat == null && e.latitude != null) {
      row.lat = e.latitude;
      row.lng = e.longitude;
    }
    if (e.venue?.trim()) row.venues.set(e.venue, (row.venues.get(e.venue) ?? 0) + 1);
    if (!existing) byKey.set(key, row);
  }
  return [...byKey.values()];
}

/** Falls back to the city/state lookup for events stored without coordinates. */
function coordsFor(row: SuburbRow): [number, number] {
  if (row.lat != null && row.lng != null) return [row.lat, row.lng];
  return getEventCoords(row.city, row.state);
}

/**
 * Location suggestions for the search bars' where field.
 *
 * Only suggests suburbs that actually host events, so a suggestion can never
 * lead to an empty listing. When the typed suburb hosts none, it is geocoded
 * once and the nearest hosting suburbs are returned instead — the geocoder is
 * touched only on that miss, not on every keystroke.
 */
export async function GET(req: NextRequest) {
  const parsed = suburbQuery.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ results: [], nearby: false });
  }

  const q = parsed.data.q.toLowerCase();
  const suburbs = await loadEventSuburbs({
    type: parsed.data.type,
    division: parsed.data.division,
  });

  const named = suburbs
    .filter((s) => s.city.toLowerCase().includes(q))
    .sort((a, b) =>
      // Prefix matches first ("syd" -> Sydney before Kingsyd), then busier suburbs.
      Number(b.city.toLowerCase().startsWith(q)) - Number(a.city.toLowerCase().startsWith(q)) ||
      b.count - a.count ||
      a.city.localeCompare(b.city));

  // Events record a metro city plus a venue, and the venue is where the suburb
  // usually lives ("Bondi Beach" in Sydney, "Albert Park Circuit" in
  // Melbourne). Matching venues as well means a suburb search finds the event
  // instead of falling through to the geocoder.
  const venueMatches = suburbs
    .flatMap((s) =>
      [...s.venues]
        .filter(([venue]) => venue.toLowerCase().includes(q))
        .map(([venue, count]) => ({ suburb: s, venue, count })))
    .sort((a, b) =>
      Number(b.venue.toLowerCase().startsWith(q)) - Number(a.venue.toLowerCase().startsWith(q)) ||
      b.count - a.count ||
      a.venue.localeCompare(b.venue));

  if (named.length > 0 || venueMatches.length > 0) {
    const results: SuburbSuggestion[] = [
      ...named.map(({ city, state, count }) => ({ city, state, eventCount: count })),
      // Venue hits sit under exact suburb hits, and never duplicate a suburb
      // already listed by name.
      ...venueMatches
        .filter(({ suburb }) => !named.some((n) => n.city === suburb.city && n.state === suburb.state))
        .map(({ suburb, venue, count }) => ({
          city: suburb.city, state: suburb.state, venue, eventCount: count,
        })),
    ];

    return NextResponse.json({ nearby: false, results: results.slice(0, MAX_RESULTS) });
  }

  // Nothing by that name hosts an event: locate the query and offer the closest
  // suburbs that do.
  const place = await geocodePlace(parsed.data.q);
  if (!place || place.latitude == null || place.longitude == null) {
    return NextResponse.json({ results: [], nearby: false });
  }

  const nearby = suburbs
    .map((s) => {
      const [lat, lng] = coordsFor(s);
      return { ...s, distanceKm: haversineDistance(place.latitude!, place.longitude!, lat, lng) };
    })
    .filter((s) => s.distanceKm <= NEARBY_RADIUS_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, MAX_RESULTS);

  return NextResponse.json({
    nearby: true,
    searched: place.city || parsed.data.q,
    results: nearby.map(({ city, state, count, distanceKm }): SuburbSuggestion => ({
      city, state, eventCount: count, distanceKm: Math.round(distanceKm),
    })),
  });
}
