import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { MapPin } from "lucide-react";
import type { UserEvent } from "@/types";
import type { PublicReview } from "@/lib/reviews";
import type { OrganiserPublicStats } from "@/lib/organiser-follows";
import type { ReviewEventOption } from "@/components/organiser/ReviewsSection";
import HomeEventCard from "@/components/HomeEventCard";
import OrganiserReviewsClient from "@/components/OrganiserReviewsClient";
import OrganiserRating from "@/components/OrganiserRating";
import OrganiserFollowSection from "@/components/OrganiserFollowSection";
import OrganiserEditProfileButton from "@/components/OrganiserEditProfileButton";
import { ScrollCarousel } from "@/components/ui/ScrollCarousel";

export type OrganiserProfileData = {
  id: string;
  orgName: string | null;
  bio: string | null;
  logoUrl: string | null;
  logoPosition: string | null;
  coverImageUrl: string | null;
  coverPosition: string | null;
  createdAt: Date;
};

type Props = {
  organiser: OrganiserProfileData;
  upcoming: UserEvent[];
  past: UserEvent[];
  reviews: PublicReview[];
  reviewEvents: ReviewEventOption[];
  stats: OrganiserPublicStats;
  rating: { average: number; count: number } | null;
  action: "follow" | "edit";
  /** Hide write-review CTAs (portal twin). */
  reviewsReadOnly?: boolean;
  browseEventsHref?: string;
};

function formatCount(n: number) {
  return n.toLocaleString("en-AU");
}

function ProfileStats({ stats }: { stats: OrganiserPublicStats }) {
  return (
    <div className="flex items-end gap-4 sm:gap-5">
      <div className="text-center">
        <div className="font-headline text-xl sm:text-2xl font-black tracking-tighter text-light leading-none">
          {formatCount(stats.registrations)}
        </div>
        <div className="font-headline text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted mt-1">
          Registrations
        </div>
      </div>
      <div className="text-center">
        <div className="font-headline text-xl sm:text-2xl font-black tracking-tighter text-light leading-none">
          {formatCount(stats.followers)}
        </div>
        <div className="font-headline text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted mt-1">
          Followers
        </div>
      </div>
      <div className="text-center">
        <div className="font-headline text-xl sm:text-2xl font-black tracking-tighter text-light leading-none">
          {formatCount(stats.eventsHosted)}
        </div>
        <div className="font-headline text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted mt-1">
          Events hosted
        </div>
      </div>
    </div>
  );
}

export default function OrganiserProfileView({
  organiser,
  upcoming,
  past,
  reviews,
  reviewEvents,
  stats,
  rating,
  action,
  reviewsReadOnly = false,
  browseEventsHref = "/events",
}: Props) {
  const name = organiser.orgName ?? "Event Organiser";

  return (
    <main className="min-h-screen bg-dark-darker pt-14">
      {/* ── Cover ── */}
      <div className="relative w-full h-44 sm:h-60 overflow-hidden">
        {organiser.coverImageUrl ? (
          <Image
            src={organiser.coverImageUrl}
            alt=""
            fill
            className="object-cover brightness-[0.55]"
            style={{ objectPosition: organiser.coverPosition ?? "50% 50%" }}
            sizes="100vw"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-dark via-dark-lighter to-dark-darker" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-darker via-dark-darker/40 to-transparent" />
      </div>

      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 pb-12">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 -mt-12 sm:-mt-14 relative z-10">
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-dark-lighter bg-dark shrink-0">
            {organiser.logoUrl ? (
              <Image
                src={organiser.logoUrl}
                alt={`${name} logo`}
                fill
                className="object-cover"
                style={{ objectPosition: organiser.logoPosition ?? "50% 50%" }}
                sizes="112px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-headline text-3xl font-black italic text-primary">
                {name.charAt(0)}
              </div>
            )}
          </div>

          <div className="flex flex-1 min-w-0 flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 pb-1">
            <div className="min-w-0 shrink-0">
              <h1 className="font-headline text-3xl sm:text-4xl font-black italic tracking-tighter text-light leading-tight">
                {name}
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-1.5">
                <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted">
                  Organiser since {format(organiser.createdAt, "MMMM yyyy")}
                </p>
                <OrganiserRating rating={rating} size="md" />
              </div>
            </div>

            {action === "follow" ? (
              <OrganiserFollowSection
                organiserId={organiser.id}
                initialStats={stats}
              />
            ) : (
              <div className="flex items-end gap-4 sm:gap-5 ml-auto shrink-0">
                <ProfileStats stats={stats} />
                <OrganiserEditProfileButton />
              </div>
            )}
          </div>
        </div>

        {/* ── Bio ── */}
        {organiser.bio && (
          <div className="mt-6 max-w-3xl">
            <p className="text-sm font-medium text-muted leading-relaxed">{organiser.bio}</p>
          </div>
        )}

        {/* ── Upcoming events + map placeholder ── */}
        <div className="mt-10">
          <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-4">
            Upcoming Events ({upcoming.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
            <div>
              {upcoming.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
                  {upcoming.map((event) => (
                    <HomeEventCard key={event.id} event={event} className="w-full" />
                  ))}
                </div>
              ) : (
                <div className="bg-dark rounded-xl px-6 py-10 text-center">
                  <p className="font-headline text-sm font-medium text-muted">
                    No upcoming events right now — check back soon.
                  </p>
                  <Link
                    href={browseEventsHref}
                    className="inline-block mt-3 font-headline text-xs font-bold uppercase tracking-widest text-primary hover:underline"
                  >
                    Browse all events
                  </Link>
                </div>
              )}
            </div>

            <div className="lg:sticky lg:top-20 h-[320px] lg:h-[min(70vh,640px)] rounded-2xl border border-dark-lighter bg-dark overflow-hidden">
              <div className="h-full flex flex-col items-center justify-center gap-2 px-6 text-center">
                <MapPin className="w-6 h-6 text-primary/60" />
                <p className="font-headline text-xs font-bold uppercase tracking-widest text-muted">
                  Map coming soon
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Previous events ── */}
        {past.length > 0 && (
          <div className="mt-10">
            <ScrollCarousel eyebrow="Archive" title="Previous Events">
              {past.map((event) => (
                <HomeEventCard key={event.id} event={event} />
              ))}
            </ScrollCarousel>
          </div>
        )}

        <OrganiserReviewsClient
          organiserId={organiser.id}
          initialReviews={reviews}
          events={reviewEvents}
          readOnly={reviewsReadOnly}
        />
      </section>
    </main>
  );
}
