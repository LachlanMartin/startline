import type { UserEvent } from "@/types";
import { getEventCoords } from "@/lib/australia-coords";

/** Resolve event coordinates from DB values, falling back to city/state lookup. */
export function eventLngLat(event: UserEvent): { lat: number; lng: number } | null {
  const rawLat = event.latitude as unknown;
  const rawLng = event.longitude as unknown;
  if (rawLat != null && rawLng != null && rawLat !== "" && rawLng !== "") {
    const lat = typeof rawLat === "number" ? rawLat : Number(rawLat);
    const lng = typeof rawLng === "number" ? rawLng : Number(rawLng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  if (event.city && event.state) {
    const [lat, lng] = getEventCoords(event.city, event.state);
    return { lat, lng };
  }

  return null;
}

export function hasCoordinates(event: UserEvent): boolean {
  return eventLngLat(event) !== null;
}

export function filterMapEvents(events: UserEvent[]): UserEvent[] {
  return events.filter(hasCoordinates);
}
