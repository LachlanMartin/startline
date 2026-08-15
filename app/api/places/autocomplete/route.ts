import { NextRequest, NextResponse } from "next/server";
import { GeoPlacesClient, AutocompleteCommand } from "@aws-sdk/client-geo-places";
import { z } from "zod";

const client = new GeoPlacesClient({ region: "ap-southeast-2" });

const autocompleteQuery = z.object({ q: z.string().trim().min(2).max(200).catch("") });

export async function GET(req: NextRequest) {
  const { q } = autocompleteQuery.parse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q)
    return NextResponse.json({ results: [] });

  const cmd = new AutocompleteCommand({
    QueryText: q,
    MaxResults: 5,
    Filter: { IncludeCountries: ["AUS"] },
  });

  try {
    const res = await client.send(cmd);
    const results = (res.ResultItems ?? []).map(item => ({
      placeId: item.PlaceId,
      label: item.Address?.Label ?? item.Title ?? "",
      title: item.Title ?? "",
      placeType: item.PlaceType,
    }));
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
