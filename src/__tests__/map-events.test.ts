import { describe, it, expect } from "vitest";
import { eventLngLat, hasCoordinates, filterMapEvents } from "@/lib/map-events";
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

describe("map-events helpers", () => {
  it("eventLngLat returns coordinates for valid numbers", () => {
    expect(eventLngLat({ ...baseEvent, latitude: -37.8, longitude: 144.9 })).toEqual({
      lat: -37.8,
      lng: 144.9,
    });
  });

  it("eventLngLat falls back to city/state lookup", () => {
    const ll = eventLngLat(baseEvent);
    expect(ll).toEqual({ lat: -37.8136, lng: 144.9631 });
  });

  it("eventLngLat returns null when city or state is missing", () => {
    expect(eventLngLat({ ...baseEvent, city: "", state: "vic" })).toBeNull();
  });

  it("hasCoordinates and filterMapEvents include events with stored or fallback coords", () => {
    const withCoords = { ...baseEvent, id: "2", latitude: -33.8, longitude: 151.2 };
    expect(hasCoordinates(withCoords)).toBe(true);
    expect(hasCoordinates(baseEvent)).toBe(true);
    expect(filterMapEvents([baseEvent, withCoords])).toHaveLength(2);
  });
});
