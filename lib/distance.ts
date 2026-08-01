import type { UserEvent } from "@/types";
import { eventLngLat } from "@/lib/map-events";

export const DEFAULT_RADIUS_KM = 100;

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two lat/lng points in kilometres (Haversine). */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/** "1.2km" for sub-10, "12km" otherwise. */
export function formatDistance(km: number): string {
  return km < 10 ? `${km.toFixed(1)}km` : `${Math.round(km)}km`;
}

/** Distance from an origin to an event's resolved coordinates, or null if the event has none. */
export function eventDistance(
  origin: { lat: number; lng: number },
  event: UserEvent
): number | null {
  const ll = eventLngLat(event);
  if (!ll) return null;
  return haversineDistance(origin.lat, origin.lng, ll.lat, ll.lng);
}
