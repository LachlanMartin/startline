import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { z } from "zod";

const reviewsQuery = z.object({
  filter: z.enum(["all", "published", "hidden"]).catch("all"),
});

export const dynamic = "force-dynamic";

// GET /api/admin/reviews?filter=all|published|hidden
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const { filter } = reviewsQuery.parse(Object.fromEntries(searchParams));
  const where =
    filter === "published" ? { isPublished: true }
    : filter === "hidden"  ? { isPublished: false }
    : {};

  try {
    const reviews = await prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        overallRating:       true,
        atmosphereRating: true,
        organisationRating:  true,
        experienceRating:    true,
        title:        true,
        body:         true,
        reviewerName: true,
        eventTitle:   true,
        isVerified:   true,
        isPublished:  true,
        createdAt:    true,
        organiser: { select: { id: true, orgName: true, email: true } },
      },
    });
    return NextResponse.json(reviews);
  } catch (err) {
    console.error("Admin reviews fetch error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
