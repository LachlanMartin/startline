import { GeoPlacesClient, GeocodeCommand } from "@aws-sdk/client-geo-places";

const client = new GeoPlacesClient({ region: "ap-southeast-2" });

export interface GeocodeResult {
  label: string;
  city: string;
  stateCode: string;
  stateName: string;
  postalCode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Resolve free text to a place via AWS Location Service.
 *
 * Returns null rather than throwing when the lookup fails or credentials are
 * absent, so callers can fall back to whatever they can compute locally. This
 * is the only place that talks to the geocoder, so callers on the server can
 * use it directly instead of making an HTTP round trip to /api/places/geocode.
 */
export async function geocodePlace(q: string): Promise<GeocodeResult | null> {
  const query = q.trim();
  if (!query) return null;

  try {
    const res = await client.send(new GeocodeCommand({ QueryText: query }));
    const item = res.ResultItems?.[0];
    if (!item?.Address) return null;

    return {
      label: item.Address.Label ?? "",
      city: item.Address.Locality ?? "",
      stateCode: (item.Address.Region?.Code ?? "").toLowerCase(),
      stateName: item.Address.Region?.Name ?? "",
      postalCode: item.Address.PostalCode ?? "",
      country: item.Address.Country?.Name ?? "",
      latitude: item.Position?.[1] ?? null,
      longitude: item.Position?.[0] ?? null,
    };
  } catch {
    return null;
  }
}
