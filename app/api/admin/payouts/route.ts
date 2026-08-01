import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/amplify-server";
import { getPayoutEligibleEvents, runPayoutForEvent } from "@/lib/payout";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  try {
    const eligible = await getPayoutEligibleEvents();
    return NextResponse.json({ events: eligible });
  } catch (err) {
    console.error("Admin payout list error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const body = await req.json().catch(() => null) as { eventId?: string } | null;
  const eventId = body?.eventId;
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  try {
    const { netCents } = await runPayoutForEvent(eventId);
    return NextResponse.json({ ok: true, eventId, netCents });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payout failed.";
    const status = message.includes("not found") ? 404
      : message.includes("already triggered") ? 409
      : 422;
    return NextResponse.json({ error: message }, { status });
  }
}
