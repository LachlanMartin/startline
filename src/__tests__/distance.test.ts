import { describe, it, expect } from "vitest";
import { haversineDistance, formatDistance, eventDistance, DEFAULT_RADIUS_KM } from "@/lib/distance";
import type { UserEvent } from "@/types";

const baseEvent: UserEvent = {
  id: "1",
  title: "Test Event",
  description: "Desc",
  date: "2026-08-15",
  time: "09:00",
  location: "Venue",
  city: "Melbourne",
  state: "vic",
  type: "running",
  discipline: "running",
  format: "individual",
  level: "open",
  image: "",
  registrationUrl: null,
  registrationType: "startline",
  feeStructure: "athlete",
  organiserId: "org-1",
  fromPrice: null,
  registrationCount: 0,
};

describe("haversineDistance", () => {
  it("returns 0 for identical points", () => {
    expect(haversineDistance(-33.8688, 151.2093, -33.8688, 151.2093)).toBeCloseTo(0, 1);
  });

  it("Sydney → Melbourne is roughly 713km", () => {
    const d = haversineDistance(-33.8688, 151.2093, -37.8136, 144.9631);
    expect(d).toBeGreaterThan(700);
    expect(d).toBeLessThan(730);
  });

  it("Byron Bay → Gold Coast is roughly 65km", () => {
    const d = haversineDistance(-28.6474, 153.602, -28.0167, 153.4);
    expect(d).toBeGreaterThan(55);
    expect(d).toBeLessThan(75);
  });

  it("is symmetric", () => {
    const a = haversineDistance(-33.8, 151.2, -37.8, 144.9);
    const b = haversineDistance(-37.8, 144.9, -33.8, 151.2);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe("formatDistance", () => {
  it("formats sub-10km with one decimal", () => {
    expect(formatDistance(0.5)).toBe("0.5km");
    expect(formatDistance(9.4)).toBe("9.4km");
  });

  it("formats 10km+ as rounded integers", () => {
    expect(formatDistance(12)).toBe("12km");
    expect(formatDistance(87.4)).toBe("87km");
    expect(formatDistance(1200)).toBe("1200km");
  });
});

describe("eventDistance", () => {
  const origin = { lat: -33.8688, lng: 151.2093 }; // Sydney

  it("computes distance for events with stored coords", () => {
    const d = eventDistance(origin, { ...baseEvent, latitude: -37.8, longitude: 144.9 });
    expect(d).not.toBeNull();
    expect(d!).toBeGreaterThan(700);
  });

  it("falls back to city/state lookup for events without coords", () => {
    const d = eventDistance(origin, { ...baseEvent, city: "Melbourne", state: "vic" });
    expect(d).not.toBeNull();
    expect(d!).toBeGreaterThan(700);
  });

  it("returns null when the event has no resolvable coords", () => {
    expect(eventDistance(origin, { ...baseEvent, city: "", state: "vic" })).toBeNull();
  });
});

describe("DEFAULT_RADIUS_KM", () => {
  it("caps at 100km", () => {
    expect(DEFAULT_RADIUS_KM).toBe(100);
  });
});
