import prisma from "@/lib/prisma";
import {
  toOrganiserRating,
  type OrganiserRating,
} from "@/lib/review-helpers";

export type { OrganiserRating, TopRatedEvent } from "@/lib/review-helpers";
export {
  averageOverallRating,
  displayNameFromUser,
  toOrganiserRating,
  topRatedEventsFromReviews,
} from "@/lib/review-helpers";

export type PublicReview = {
  id: string;
  reviewerName: string;
  eventId: string | null;
  eventTitle: string | null;
  overallRating: number;
  atmosphereRating: number | null;
  organisationRating: number | null;
  experienceRating: number | null;
  title: string;
  body: string;
  isVerified: boolean;
  createdAt: string;
};

/** Batch organiser rating aggregates for the given IDs (published reviews only). */
export async function getOrganiserRatings(
  organiserIds: string[]
): Promise<Map<string, OrganiserRating>> {
  const ids = [...new Set(organiserIds.filter(Boolean))];
  const map = new Map<string, OrganiserRating>();
  if (ids.length === 0) return map;

  try {
    const rows = await prisma.review.groupBy({
      by: ["organiserId"],
      where: { isPublished: true, organiserId: { in: ids } },
      _avg: { overallRating: true },
      _count: { _all: true },
    });
    for (const row of rows) {
      const rating = toOrganiserRating(row._avg.overallRating, row._count._all);
      if (rating) map.set(row.organiserId, rating);
    }
  } catch {
    // DB unavailable — leave map empty
  }
  return map;
}

export async function getPublishedOrganiserReviews(
  organiserId: string
): Promise<PublicReview[]> {
  try {
    const reviews = await prisma.review.findMany({
      where: { organiserId, isPublished: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        reviewerName: true,
        eventId: true,
        eventTitle: true,
        overallRating: true,
        atmosphereRating: true,
        organisationRating: true,
        experienceRating: true,
        title: true,
        body: true,
        isVerified: true,
        createdAt: true,
      },
    });
    return reviews.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch {
    return [];
  }
}
