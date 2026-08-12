import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/amplify-server";
import { getPayoutEligibleEvents, runPayoutForEvent } from "@/lib/payout";
import { z } from "zod";

const payoutSchema = z.object({ eventId: z.string().min(1).max(255) });

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

  const parsed = payoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }
  const eventId = parsed.data.eventId;

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
