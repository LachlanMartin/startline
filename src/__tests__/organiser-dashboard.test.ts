import { describe, expect, it } from "vitest";
import {
  buildTrendDays,
  computeCapacityFilledPct,
  computeCurrentStats,
  isWithinNextDays,
  toDayKey,
} from "@/lib/organiser-dashboard";

describe("organiser-dashboard helpers", () => {
  const now = new Date("2026-08-09T12:00:00");

  it("toDayKey formats local calendar day", () => {
    expect(toDayKey(new Date("2026-08-09T00:00:00"))).toBe("2026-08-09");
  });

  it("isWithinNextDays includes today and day 30, excludes day 31", () => {
    expect(isWithinNextDays("2026-08-09", 30, now)).toBe(true);
    expect(isWithinNextDays("2026-09-08", 30, now)).toBe(true);
    expect(isWithinNextDays("2026-09-09", 30, now)).toBe(false);
    expect(isWithinNextDays("2026-08-01", 30, now)).toBe(false);
  });

  it("computeCapacityFilledPct ignores uncapped events", () => {
    const events = [
      { id: "a", status: "APPROVED", eventDate: "2026-08-20", cap: 100 },
      { id: "b", status: "APPROVED", eventDate: "2026-08-21", cap: null },
      { id: "c", status: "DRAFT", eventDate: "2026-08-22", cap: 50 },
    ];
    const counts = new Map([
      ["a", 25],
      ["b", 10],
      ["c", 40],
    ]);
    expect(computeCapacityFilledPct(events, counts)).toBe(25);
  });

  it("computeCapacityFilledPct returns null when no caps", () => {
    const events = [{ id: "a", status: "APPROVED", eventDate: "2026-08-20", cap: null }];
    expect(computeCapacityFilledPct(events, new Map([["a", 5]]))).toBeNull();
  });

  it("computeCurrentStats counts live and racing windows", () => {
    const events = [
      { id: "live", status: "APPROVED", eventDate: "2026-08-20", cap: 100 },
      { id: "soon", status: "APPROVED", eventDate: "2026-09-01", cap: 50 },
      { id: "far", status: "APPROVED", eventDate: "2026-12-01", cap: 50 },
      { id: "draft", status: "DRAFT", eventDate: "2026-08-15", cap: 20 },
    ];
    const counts = new Map([
      ["live", 10],
      ["soon", 5],
      ["far", 2],
      ["draft", 99],
    ]);
    const stats = computeCurrentStats(events, counts, now);
    expect(stats.live).toBe(3);
    expect(stats.racingIn30Days).toBe(2);
    expect(stats.liveRegistrations).toBe(17);
    expect(stats.capacityFilledPct).toBe(Math.round((17 / 200) * 100));
  });

  it("buildTrendDays buckets confirmed regs into 30 days", () => {
    const days = buildTrendDays(
      [
        {
          eventId: "a",
          amountCents: 10000,
          platformFeeCents: 500,
          createdAt: new Date("2026-08-09T10:00:00"),
        },
        {
          eventId: "a",
          amountCents: 5000,
          platformFeeCents: 200,
          createdAt: new Date("2026-08-08T10:00:00"),
        },
        {
          eventId: "a",
          amountCents: 1000,
          platformFeeCents: 0,
          createdAt: new Date("2026-07-01T10:00:00"),
        },
      ],
      30,
      now,
    );
    expect(days).toHaveLength(30);
    expect(days[0].date).toBe("2026-07-11");
    expect(days[days.length - 1].date).toBe("2026-08-09");
    const today = days.find((d) => d.date === "2026-08-09");
    const yesterday = days.find((d) => d.date === "2026-08-08");
    expect(today?.registrations).toBe(1);
    expect(today?.revenueCents).toBe(9500);
    expect(yesterday?.registrations).toBe(1);
    expect(yesterday?.revenueCents).toBe(4800);
    expect(days.reduce((s, d) => s + d.registrations, 0)).toBe(2);
  });
});
