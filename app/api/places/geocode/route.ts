import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { geocodePlace } from "@/lib/geocode";

const geocodeQuery = z.object({ q: z.string().trim().max(300).catch("") });

export async function GET(req: NextRequest) {
  const { q } = geocodeQuery.parse(Object.fromEntries(req.nextUrl.searchParams));
  const result = await geocodePlace(q);
  return NextResponse.json({ result });
}
