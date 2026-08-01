import { describe, it, expect } from "vitest";
import { buildOrganiserEventLiveNotifications } from "@/lib/notify-organiser-followers";
import { shiftIsoDate } from "@/lib/duplicate-event";

describe("buildOrganiserEventLiveNotifications", () => {
  it("builds one ORGANISER_EVENT_LIVE row per follower", () => {
    const rows = buildOrganiserEventLiveNotifications(["u1", "u2"], {
      eventId: "evt-1",
      eventTitle: "Tuesday Tempo",
      organiserName: "Apex Endurance Events",
    });

    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.type === "ORGANISER_EVENT_LIVE")).toBe(true);
    expect(rows.every((r) => r.eventId === "evt-1")).toBe(true);
    expect(rows.every((r) => r.body === "Tuesday Tempo")).toBe(true);
    expect(rows[0].userId).toBe("u1");
    expect(rows[1].userId).toBe("u2");
    expect(rows[0].title).toBe("Apex Endurance Events posted a new event");
  });

  it("falls back when organiser name is missing", () => {
    const [row] = buildOrganiserEventLiveNotifications(["u1"], {
      eventId: "evt-1",
      eventTitle: "Park Run",
      organiserName: null,
    });
    expect(row.title).toBe("An organiser you follow posted a new event");
  });

  it("only targets the provided follower ids", () => {
    const rows = buildOrganiserEventLiveNotifications(["only-me"], {
      eventId: "e",
      eventTitle: "X",
      organiserName: "Club",
    });
    expect(rows.map((r) => r.userId)).toEqual(["only-me"]);
  });
});

describe("shiftIsoDate", () => {
  it("shifts yyyy-mm-dd by seven days", () => {
    expect(shiftIsoDate("2026-08-01", 7)).toBe("2026-08-08");
  });

  it("handles month boundaries", () => {
    expect(shiftIsoDate("2026-01-28", 7)).toBe("2026-02-04");
  });

  it("returns null for empty or invalid input", () => {
    expect(shiftIsoDate(null, 7)).toBeNull();
    expect(shiftIsoDate("", 7)).toBeNull();
    expect(shiftIsoDate("not-a-date", 7)).toBeNull();
  });
});
