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
});

export interface SuburbSuggestion {
  city: string;
  state: string;
  eventCount: number;
  /** Set only on nearby fallback results, in km from the searched place. */
  distanceKm?: number;
}

interface SuburbRow {
  city: string;
  state: string;
  count: number;
  lat: number | null;
  lng: number | null;
}

/**
 * Collapse approved events down to the distinct suburbs that actually host
 * them, with a representative coordinate for each.
 */
async function loadEventSuburbs(): Promise<SuburbRow[]> {
  const events = await prisma.event.findMany({
    where: { status: "APPROVED" },
    select: { city: true, state: true, latitude: true, longitude: true },
  });

  const byKey = new Map<string, SuburbRow>();
  for (const e of events) {
    if (!e.city) continue;
    const key = `${e.city.toLowerCase()}|${e.state}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
      if (existing.lat == null && e.latitude != null) {
        existing.lat = e.latitude;
        existing.lng = e.longitude;
      }
    } else {
      byKey.set(key, {
        city: e.city, state: e.state, count: 1,
        lat: e.latitude, lng: e.longitude,
      });
    }
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
  const suburbs = await loadEventSuburbs();

  const named = suburbs
    .filter((s) => s.city.toLowerCase().includes(q))
    .sort((a, b) =>
      // Prefix matches first ("syd" -> Sydney before Kingsyd), then busier suburbs.
      Number(b.city.toLowerCase().startsWith(q)) - Number(a.city.toLowerCase().startsWith(q)) ||
      b.count - a.count ||
      a.city.localeCompare(b.city));

  if (named.length > 0) {
    return NextResponse.json({
      nearby: false,
      results: named.slice(0, MAX_RESULTS).map(({ city, state, count }): SuburbSuggestion => ({
        city, state, eventCount: count,
      })),
    });
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
