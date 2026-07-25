import { describe, it, expect } from "vitest";
import { cn, formatEventDate, formatShortDate, formatTime, formatCompetitionFormat, truncateTitle, filterEvents, sortEventsByDate, sortEvents, getUpcomingEvents, getPastEvents, getTotalUpcomingEvents } from "@/lib/utils";
import { addDays, format } from "date-fns";
import type { UserEvent, FilterState } from "@/types";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("filters out falsy values", () => {
    expect(cn("foo", false, undefined, null, "", "bar")).toBe("foo bar");
  });

  it("resolves Tailwind conflicts - later classes win", () => {
    expect(cn("p-4", "p-8")).toBe("p-8");
  });

  it("handles conditional classes", () => {
    const active = true;
    expect(cn("base", active && "active")).toBe("base active");
    expect(cn("base", !active && "active")).toBe("base");
  });

  it("handles arrays", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });

  it("handles key-value objects", () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
  });
});

describe("formatEventDate", () => {
  it("formats an ISO date string into a readable format", () => {
    const result = formatEventDate("2026-07-15");
    expect(result).toContain("15");
    expect(result).toContain("July");
    expect(result).toContain("2026");
  });
});

describe("formatShortDate", () => {
  it("formats as day and month abbreviation", () => {
    const result = formatShortDate("2026-12-25");
    expect(result).toBe("25 Dec");
  });
});

describe("formatTime", () => {
  it("converts 24h to 12h AM/PM", () => {
    expect(formatTime("07:00")).toBe("7:00 AM");
    expect(formatTime("14:30")).toBe("2:30 PM");
    expect(formatTime("00:00")).toBe("12:00 AM");
    expect(formatTime("12:00")).toBe("12:00 PM");
  });
});

describe("formatCompetitionFormat", () => {
  it("capitalises format labels", () => {
    expect(formatCompetitionFormat("team")).toBe("Team");
    expect(formatCompetitionFormat("both")).toBe("Individual & Team");
    expect(formatCompetitionFormat("individual")).toBe("Individual");
  });
});



describe("truncateTitle", () => {
  it("returns the full title when short enough", () => {
    expect(truncateTitle("Sydney Fitness Race", 28)).toBe("Sydney Fitness Race");
  });

  it("truncates with ellipsis for long titles", () => {
    expect(truncateTitle("The Most Amazing CrossFit Competition Ever Held in Australia This Year", 28))
      .toBe("The Most Amazing CrossFit Co…");
  });
});

describe("sortEventsByDate", () => {
  it("sorts events by date ascending", () => {
    const events = [
      { date: "2026-07-15" } as UserEvent,
      { date: "2026-05-10" } as UserEvent,
      { date: "2026-09-01" } as UserEvent,
    ];
    const sorted = sortEventsByDate(events);
    expect(sorted[0].date).toBe("2026-05-10");
    expect(sorted[1].date).toBe("2026-07-15");
    expect(sorted[2].date).toBe("2026-09-01");
  });
});

describe("filterEvents", () => {
  const baseEvents: UserEvent[] = [
    { date: "2026-08-20", type: "crossfit", state: "vic", format: "team", level: "elite", fromPrice: 150, title: "CrossFit Melbourne", city: "Melbourne", location: "Melbourne Arena" } as UserEvent,
    { date: "2025-01-01", type: "running", state: "qld", format: "individual", level: "open", fromPrice: 40, title: "Old Event", city: "Brisbane", location: "GABBA" } as UserEvent,
    { date: "2026-09-10", type: "running", state: "nsw", format: "individual", level: "open", fromPrice: 40, title: "Fun Run", city: "Sydney", location: "Park" } as UserEvent,
  ];

  const emptyFilters: FilterState = { types: [], states: [], formats: [], levels: [], priceRange: null, dateRange: "all", searchQuery: "" };

  it("excludes past events", () => {
    const result = filterEvents(baseEvents, emptyFilters);
    const dates = result.map((e) => e.date);
    expect(dates).not.toContain("2025-01-01");
  });

  it("filters by type", () => {
    const result = filterEvents(baseEvents, { ...emptyFilters, types: ["crossfit"] });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("crossfit");
  });

  it("filters by state", () => {
    const result = filterEvents(baseEvents, { ...emptyFilters, states: ["vic"] });
    expect(result).toHaveLength(1);
    expect(result[0].state).toBe("vic");
  });

  it("filters by format", () => {
    const result = filterEvents(baseEvents, { ...emptyFilters, formats: ["team"] });
    expect(result).toHaveLength(1);
    expect(result[0].format).toBe("team");
  });

  it("filters by level", () => {
    const result = filterEvents(baseEvents, { ...emptyFilters, levels: ["elite"] });
    expect(result).toHaveLength(1);
    expect(result[0].level).toBe("elite");
  });

  it("filters by price range", () => {
    const result = filterEvents(baseEvents, { ...emptyFilters, priceRange: [100, 200] });
    expect(result).toHaveLength(1);
    expect(result[0].fromPrice).toBe(150);
  });
});

describe("sortEvents", () => {
  const events: UserEvent[] = [
    { date: "2026-09-01", fromPrice: 100, registrationCount: 5 } as UserEvent,
    { date: "2026-05-10", fromPrice: 40,  registrationCount: 50 } as UserEvent,
    { date: "2026-07-15", fromPrice: 200, registrationCount: 20 } as UserEvent,
  ];

  it("sorts by date by default", () => {
    const result = sortEvents(events, "date");
    expect(result.map((e) => e.date)).toEqual(["2026-05-10", "2026-07-15", "2026-09-01"]);
  });

  it("sorts by price ascending", () => {
    const result = sortEvents(events, "price-asc");
    expect(result.map((e) => e.fromPrice)).toEqual([40, 100, 200]);
  });

  it("sorts by price descending", () => {
    const result = sortEvents(events, "price-desc");
    expect(result.map((e) => e.fromPrice)).toEqual([200, 100, 40]);
  });

  it("sorts by popularity", () => {
    const result = sortEvents(events, "popular");
    expect(result.map((e) => e.registrationCount)).toEqual([50, 20, 5]);
  });
});

describe("getUpcomingEvents", () => {
  it("returns events sorted and limited", () => {
    const today = new Date();
    const events: UserEvent[] = [
      { date: format(addDays(today, 90), "yyyy-MM-dd") } as UserEvent,
      { date: format(addDays(today, 30), "yyyy-MM-dd") } as UserEvent,
      { date: format(addDays(today, 180), "yyyy-MM-dd") } as UserEvent,
    ];
    const result = getUpcomingEvents(events, 2);
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe(format(addDays(today, 30), "yyyy-MM-dd"));
  });
});

describe("getPastEvents", () => {
  it("returns past events most recent first", () => {
    const today = new Date();
    const events: UserEvent[] = [
      { date: format(addDays(today, -90), "yyyy-MM-dd"), id: "old" } as UserEvent,
      { date: format(addDays(today, -10), "yyyy-MM-dd"), id: "recent" } as UserEvent,
      { date: format(addDays(today, 30), "yyyy-MM-dd"), id: "future" } as UserEvent,
    ];
    const result = getPastEvents(events, 10);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("recent");
    expect(result[1].id).toBe("old");
  });
});

describe("getTotalUpcomingEvents", () => {
  it("counts only future events", () => {
    const events: UserEvent[] = [
      { date: "2026-10-10" } as UserEvent,
      { date: "2020-01-01" } as UserEvent,
    ];
    expect(getTotalUpcomingEvents(events)).toBe(1);
  });
});
