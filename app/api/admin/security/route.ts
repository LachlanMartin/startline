import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { z } from "zod";

const securityQuery = z.object({
  type: z.enum(["all", "bot_check_failed", "review_reported"]).catch("all"),
  limit: z.coerce.number().int().min(1).max(100).catch(50),
});

export const dynamic = "force-dynamic";

// GET /api/admin/security?type=all|bot_check_failed|review_reported&limit=N
// Security incidents for the admin moderation view: failed bot checks and
// reported reviews, newest first.
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const { type, limit } = securityQuery.parse(Object.fromEntries(searchParams));

  try {
    const where = type === "all" ? {} : { type };

    const [events, reports] = await Promise.all([
      prisma.securityEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          type: true,
          action: true,
          ip: true,
          userId: true,
          meta: true,
          createdAt: true,
        },
      }),
      // Reported reviews are always surfaced alongside the event feed so admins
      // can act on the underlying content even when only the report exists.
      prisma.reviewReport.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          reason: true,
          createdAt: true,
          review: {
            select: {
              id: true,
              reviewerName: true,
              title: true,
              body: true,
              overallRating: true,
              isPublished: true,
              organiser: { select: { id: true, orgName: true } },
            },
          },
        },
      }),
    ]);

    const res = NextResponse.json({
      events: events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
      reports: reports.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err) {
    console.error("Admin security error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
