import { NextResponse } from "next/server";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
export async function GET() {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  try {
    const reviews = await prisma.review.findMany({
      where:   { organiserId: session.sub, isPublished: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, overallRating: true, atmosphereRating: true,
        organisationRating: true, experienceRating: true,
        title: true, body: true, reviewerName: true,
        eventTitle: true, isVerified: true, createdAt: true,
      },
    });
    return NextResponse.json(reviews);
  } catch {
    return NextResponse.json([]);
  }
}
