import { NextRequest, NextResponse } from "next/server";
import { lookupAbn } from "@/lib/abn";
import { z } from "zod";

const abnQuery = z.object({ abn: z.string().trim().min(1).max(20) });

export async function GET(req: NextRequest) {
  const parsed = abnQuery.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "abn query param required." }, { status: 400 });
  const { abn } = parsed.data;

  if (!process.env.ABR_GUID) {
    return NextResponse.json({ error: "ABR_GUID not configured." }, { status: 503 });
  }

  const result = await lookupAbn(abn);
  if (!result) return NextResponse.json({ error: "ABN not found." }, { status: 404 });

  return NextResponse.json(result);
}
