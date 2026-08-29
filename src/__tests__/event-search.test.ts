import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  default: { event: { findMany: vi.fn() } },
}));

import prisma from "@/lib/prisma";
import { GET } from "@/app/api/events/search/route";

const findMany = prisma.event.findMany as ReturnType<typeof vi.fn>;

const call = (query: string) =>
  GET(new NextRequest(`http://localhost:3000/api/events/search?${query}`));

const seedEvent = {
  id: "evt-1",
  slug: "sydney-harbour-10k",
  title: "Sydney Harbour 10K",
  city: "Sydney",
  state: "nsw",
  discipline: "running",
  eventDate: "2026-09-20",
};

describe("GET /api/events/search", () => {
  beforeEach(() => {
    findMany.mockReset();
    findMany.mockResolvedValue([seedEvent]);
  });

  it("returns matches with a slug-based href", async () => {
    const body = await (await call("q=sydney")).json();

    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toMatchObject({
      id: "evt-1",
      href: "/events/sydney-harbour-10k",
      title: "Sydney Harbour 10K",
      city: "Sydney",
      discipline: "running",
    });
  });

  it("falls back to the id for events with no slug", async () => {
    findMany.mockResolvedValue([{ ...seedEvent, slug: null }]);

    const body = await (await call("q=sydney")).json();
    expect(body.results[0].href).toBe("/events/evt-1");
  });

  it("searches only approved events, across title, venue, city and organiser", async () => {
    await call("q=sydney");

    const where = findMany.mock.calls[0][0].where;
    expect(where.status).toBe("APPROVED");
    // Mirrors the client-side filterEvents search in lib/utils.ts, so the
    // suggestions and the filtered listing agree on what counts as a match.
    expect(where.OR.map((c: Record<string, unknown>) => Object.keys(c)[0]))
      .toEqual(["title", "venue", "city", "organiser"]);
  });

  it("caps the number of suggestions", async () => {
    await call("q=run");
    expect(findMany.mock.calls[0][0].take).toBe(8);
  });

  it("ignores queries that are missing or too short to be useful", async () => {
    for (const q of ["", "q=", "q=a", "q=%20%20"]) {
      const body = await (await call(q)).json();
      expect(body.results).toEqual([]);
    }
    expect(findMany).not.toHaveBeenCalled();
  });

  it("trims the query before searching", async () => {
    await call("q=%20sydney%20");
    expect(findMany.mock.calls[0][0].where.OR[0].title.contains).toBe("sydney");
  });
});
