import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { idParams } from "@/lib/schemas";
import { recordSecurityEvent } from "@/lib/security-event";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const reportSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

// POST /api/public/reviews/[id]/report — flag a review for moderation. Reported
// reviews are not auto-deleted; they surface in the admin moderation view.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to report a review." }, { status: 401 });
  }

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }
  const { id } = parsedParams.data;

  const blocked = await rateLimit(req, {
    prefix: "review-report",
    limit: 10,
    windowSeconds: 3600,
    identifier: session.sub,
  });
  if (blocked) return blocked;

  const parsed = reportSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report." }, { status: 400 });
  }

  const review = await prisma.review.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!review) return NextResponse.json({ error: "Review not found." }, { status: 404 });

  try {
    await prisma.reviewReport.create({
      data: {
        reviewId: id,
        userId: session.sub,
        reason: parsed.data.reason,
      },
    });
  } catch (err) {
    if ((err as Record<string, unknown>).code === "P2002") {
      return NextResponse.json({ error: "You've already reported this review." }, { status: 409 });
    }
    console.error("Review report error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  await recordSecurityEvent({
    type: "review_reported",
    action: "review_report",
    userId: session.sub,
    meta: { reviewId: id, reason: parsed.data.reason },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
