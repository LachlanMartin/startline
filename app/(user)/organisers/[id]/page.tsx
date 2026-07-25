import { notFound } from "next/navigation";
import { getPublicOrganiser } from "@/lib/organisers";
import { getAllEvents, getOrganiserPastEvents } from "@/lib/events";
import { toUserEvents } from "@/lib/user-events";
import { getUpcomingEvents } from "@/lib/utils";
import { getPublishedOrganiserReviews, averageOverallRating } from "@/lib/reviews";
import { getOrganiserPublicStats } from "@/lib/organiser-follows";
import OrganiserProfileView from "@/components/OrganiserProfileView";

export const revalidate = 60;

export default async function OrganiserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const organiser = await getPublicOrganiser(id);
  if (!organiser) notFound();

  const events = toUserEvents(await getAllEvents()).filter((e) => e.organiserId === organiser.id);
  const upcoming = getUpcomingEvents(events, 100);
  const past = toUserEvents(await getOrganiserPastEvents(organiser.id, 20));
  const reviews = await getPublishedOrganiserReviews(organiser.id);
  const avg = averageOverallRating(reviews);
  const rating = avg != null ? { average: avg, count: reviews.length } : null;
  const stats = await getOrganiserPublicStats(organiser.id);

  return (
    <OrganiserProfileView
      organiser={organiser}
      upcoming={upcoming}
      past={past}
      reviews={reviews}
      reviewEvents={[...events]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((e) => ({ id: e.id, title: e.title, eventDate: e.date }))}
      stats={stats}
      rating={rating}
      action="follow"
    />
  );
}
