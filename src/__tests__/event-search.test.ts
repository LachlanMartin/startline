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

/**
 * The route makes two queries: the first tallies divisions out of the Json
 * column, the second fetches matching events.
 */
function mockQueries(
  divisionSource: Array<{ discipline: string; categories: unknown }>,
  events: unknown[] = [seedEvent],
) {
  findMany.mockReset();
  findMany.mockResolvedValueOnce(divisionSource).mockResolvedValueOnce(events);
}

const RUNNING_EVENTS = [
  { discipline: "running", categories: ["5K", "10K", "Half Marathon"] },
  { discipline: "running", categories: ["10K", "Half Marathon"] },
  { discipline: "running", categories: ["10K"] },
];

describe("GET /api/events/search", () => {
  beforeEach(() => {
    mockQueries(RUNNING_EVENTS);
  });

  it("returns matches with a slug-based href", async () => {
    const body = await (await call("q=sydney")).json();

    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toMatchObject({
      id: "evt-1",
      href: "/events/sydney-harbour-10k",
      title: "Sydney Harbour 10K",
    });
  });

  it("falls back to the id for events with no slug", async () => {
    mockQueries(RUNNING_EVENTS, [{ ...seedEvent, slug: null }]);

    const body = await (await call("q=sydney")).json();
    expect(body.results[0].href).toBe("/events/evt-1");
  });

  it("searches only approved events, across title, venue, city and organiser", async () => {
    await call("q=sydney");

    const where = findMany.mock.calls[1][0].where;
    expect(where.status).toBe("APPROVED");
    // Mirrors the client-side filterEvents search in lib/utils.ts.
    expect(where.OR.map((c: Record<string, unknown>) => Object.keys(c)[0]))
      .toEqual(["title", "venue", "city", "organiser"]);
  });

  it("caps the number of suggestions", async () => {
    await call("q=run");
    expect(findMany.mock.calls[1][0].take).toBe(8);
  });

  it("trims the query before searching", async () => {
    await call("q=%20sydney%20");
    expect(findMany.mock.calls[1][0].where.OR[0].title.contains).toBe("sydney");
  });

  it("ignores queries that are missing or too short to be useful", async () => {
    for (const q of ["", "q=", "q=a", "q=%20%20"]) {
      const body = await (await call(q)).json();
      expect(body.results).toEqual([]);
      expect(body.categories).toEqual([]);
    }
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/events/search - categories and divisions", () => {
  beforeEach(() => {
    mockQueries(RUNNING_EVENTS);
  });

  it("returns the matching category with its event count", async () => {
    const body = await (await call("q=run")).json();

    expect(body.categories).toHaveLength(1);
    expect(body.categories[0]).toMatchObject({
      value: "running",
      label: "Running",
      href: "/events?type=running",
      eventCount: 3,
    });
  });

  it("lists the category's divisions, most common first", async () => {
    const body = await (await call("q=run")).json();

    expect(body.categories[0].divisions.map((d: { name: string; eventCount: number }) =>
      [d.name, d.eventCount])).toEqual([
      ["10K", 3],
      ["Half Marathon", 2],
      ["5K", 1],
    ]);
  });

  it("gives each division a link carrying both the discipline and the division", async () => {
    const body = await (await call("q=run")).json();

    expect(body.categories[0].divisions[1].href)
      .toBe("/events?type=running&division=Half%20Marathon");
  });

  it("finds a division by name without the discipline being typed", async () => {
    const body = await (await call("q=half%20mara")).json();

    expect(body.categories).toHaveLength(1);
    expect(body.categories[0].value).toBe("running");
    expect(body.categories[0].divisions.map((d: { name: string }) => d.name))
      .toEqual(["Half Marathon"]);
  });

  it("drops categories that hold no events, so none leads to an empty listing", async () => {
    mockQueries([]);

    const body = await (await call("q=run")).json();
    expect(body.categories).toEqual([]);
  });

  it("tolerates events whose divisions are missing or not strings", async () => {
    mockQueries([
      { discipline: "running", categories: null },
      { discipline: "running", categories: ["5K", "", 42] },
    ]);

    const body = await (await call("q=run")).json();
    expect(body.categories[0].eventCount).toBe(2);
    expect(body.categories[0].divisions.map((d: { name: string }) => d.name)).toEqual(["5K"]);
  });

  it("counts categories only within the where field's location", async () => {
    await call("q=run&where=Albert%20Park%20Circuit");

    // Both queries are scoped, so the counts match what the listing would show.
    const divisionWhere = findMany.mock.calls[0][0].where;
    expect(divisionWhere.OR.map((c: Record<string, unknown>) => Object.keys(c)[0]))
      .toEqual(["city", "state", "venue"]);
    expect(divisionWhere.OR[0].city.contains).toBe("Albert Park Circuit");
    expect(findMany.mock.calls[1][0].where.AND).toBeDefined();
  });

  it("leaves the queries unscoped when the where field is empty", async () => {
    await call("q=run");

    expect(findMany.mock.calls[0][0].where.OR).toBeUndefined();
    expect(findMany.mock.calls[1][0].where.AND).toBeUndefined();
  });
});
