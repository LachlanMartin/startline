import { NextRequest, NextResponse } from "next/server";
import { GeoPlacesClient, GeocodeCommand } from "@aws-sdk/client-geo-places";

const client = new GeoPlacesClient({ region: "ap-southeast-2" });

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q)
    return NextResponse.json({ result: null });

  const cmd = new GeocodeCommand({ QueryText: q });

  try {
    const res = await client.send(cmd);
    const item = res.ResultItems?.[0];
    if (!item?.Address)
      return NextResponse.json({ result: null });

    return NextResponse.json({
      result: {
        label: item.Address.Label,
        city: item.Address.Locality ?? "",
        stateCode: (item.Address.Region?.Code ?? "").toLowerCase(),
        stateName: item.Address.Region?.Name ?? "",
        postalCode: item.Address.PostalCode ?? "",
        country: item.Address.Country?.Name ?? "",
        latitude: item.Position?.[1] ?? null,
        longitude: item.Position?.[0] ?? null,
      },
    });
  } catch {
    return NextResponse.json({ result: null });
  }
}
