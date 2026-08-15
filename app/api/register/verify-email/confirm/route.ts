import { NextRequest, NextResponse } from "next/server";
import { confirmGuestEmailVerificationCode } from "@/lib/guest-email-verification";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";

const verifyEmailConfirmSchema = z.object({
  eventId: z.string().max(255),
  email: z.string().max(255),
  code: z.string().max(10),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = verifyEmailConfirmSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Missing event, email, or code." }, { status: 400 });
    }
    const { eventId, email, code } = parsed.data;

    const blocked = await rateLimit(req, {
      prefix: "verify-email-confirm",
      limit: 10,
      windowSeconds: 60,
      identifier: email?.toLowerCase(),
    });
    if (blocked) return blocked;

    const result = await confirmGuestEmailVerificationCode(email, eventId, code);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Guest verify confirm error:", err);
    return NextResponse.json({ error: "Failed to verify code." }, { status: 503 });
  }
}
