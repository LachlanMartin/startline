import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  default: { event: { findMany: vi.fn() } },
}));
vi.mock("@/lib/geocode", () => ({ geocodePlace: vi.fn() }));

import prisma from "@/lib/prisma";
import { geocodePlace } from "@/lib/geocode";
import { GET } from "@/app/api/events/suburbs/route";

const findMany = prisma.event.findMany as ReturnType<typeof vi.fn>;
const geocode = geocodePlace as ReturnType<typeof vi.fn>;

const call = (q: string) =>
  GET(new NextRequest(`http://localhost:3000/api/events/suburbs?q=${encodeURIComponent(q)}`));

// Sydney hosts three, Newcastle one (~115 km north), Perth one (a continent away).
const EVENTS = [
  { city: "Sydney", state: "nsw", latitude: -33.8688, longitude: 151.2093 },
  { city: "Sydney", state: "nsw", latitude: -33.8688, longitude: 151.2093 },
  { city: "Sydney", state: "nsw", latitude: -33.8688, longitude: 151.2093 },
  { city: "Newcastle", state: "nsw", latitude: -32.9283, longitude: 151.7817 },
  { city: "Perth", state: "wa", latitude: -31.9505, longitude: 115.8605 },
];

describe("GET /api/events/suburbs", () => {
  beforeEach(() => {
    findMany.mockReset();
    geocode.mockReset();
    findMany.mockResolvedValue(EVENTS);
  });

  it("suggests suburbs that host events, with their counts", async () => {
    const body = await (await call("syd")).json();

    expect(body.nearby).toBe(false);
    expect(body.results).toEqual([{ city: "Sydney", state: "nsw", eventCount: 3 }]);
    expect(geocode).not.toHaveBeenCalled();
  });

  it("does not geocode when a name matches, keeping the lookup free", async () => {
    await call("newcastle");
    expect(geocode).not.toHaveBeenCalled();
  });

  it("orders prefix matches ahead of mid-word ones, then by event count", async () => {
    findMany.mockResolvedValue([
      { city: "Port Newcastle", state: "nsw", latitude: -32.9, longitude: 151.7 },
      { city: "Port Newcastle", state: "nsw", latitude: -32.9, longitude: 151.7 },
      { city: "Newcastle", state: "nsw", latitude: -32.9283, longitude: 151.7817 },
    ]);

    const body = await (await call("newcastle")).json();
    expect(body.results.map((r: { city: string }) => r.city)).toEqual(["Newcastle", "Port Newcastle"]);
  });

  it("falls back to the nearest hosting suburbs when nothing matches by name", async () => {
    // Parramatta hosts no events but sits ~23 km west of Sydney.
    geocode.mockResolvedValue({ latitude: -33.815, longitude: 151.0, city: "Parramatta" });

    const body = await (await call("parramatta")).json();

    expect(body.nearby).toBe(true);
    expect(body.searched).toBe("Parramatta");
    expect(body.results[0].city).toBe("Sydney");
    expect(body.results[0].distanceKm).toBeLessThan(40);
    // Perth is thousands of km away and must not be offered as "nearby".
    expect(body.results.map((r: { city: string }) => r.city)).not.toContain("Perth");
  });

  it("returns nothing when the query cannot be located either", async () => {
    geocode.mockResolvedValue(null);

    const body = await (await call("nowhere-at-all")).json();
    expect(body.results).toEqual([]);
    expect(body.nearby).toBe(false);
  });

  it("ignores queries too short to be useful, without hitting the database", async () => {
    for (const q of ["", "a"]) {
      const body = await (await call(q)).json();
      expect(body.results).toEqual([]);
    }
    expect(findMany).not.toHaveBeenCalled();
  });
});
