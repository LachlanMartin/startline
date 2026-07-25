import { redirect } from "next/navigation";
import { getOrganiserSession } from "@/lib/amplify-server";
import { getPublicOrganiser } from "@/lib/organisers";
import { getAllEvents, getOrganiserPastEvents } from "@/lib/events";
import { toUserEvents } from "@/lib/user-events";
import { getUpcomingEvents } from "@/lib/utils";
import { getPublishedOrganiserReviews, averageOverallRating } from "@/lib/reviews";
import { getOrganiserPublicStats } from "@/lib/organiser-follows";
import OrganiserProfileView from "@/components/OrganiserProfileView";

export default async function OrganiserPortalProfilePage() {
  const session = await getOrganiserSession();
  if (!session) redirect("/organiser");

  const organiser = await getPublicOrganiser(session.sub, { requireApproved: false });
  if (!organiser) redirect("/organiser");

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
      action="edit"
      reviewsReadOnly
      browseEventsHref="/organiser/listings"
    />
  );
}
