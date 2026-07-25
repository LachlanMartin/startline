import Image from "next/image";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Calendar, ExternalLink, Trophy, Clock, Ticket } from "lucide-react";
import { getAllEvents, getPublicEventById } from "@/lib/events";
import { todayIso } from "@/lib/event-types";
import { parsePrizePool } from "@/lib/prize-pool";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { toUserEvent } from "@/lib/user-events";
import { STATE_LABELS } from "@/types";
import {
  formatEventDate,
  formatEventDateRange,
  formatLongDate,
  formatTime,
  formatCompetitionFormat,
  formatLevel,
  formatDiscipline,
} from "@/lib/utils";
import { Button } from "@/components/ui/button";
import EventGallery from "@/components/EventGallery";
import EventReviewsSection from "@/components/EventReviewsSection";
import OrganiserRating from "@/components/OrganiserRating";
import { getPublishedOrganiserReviews, averageOverallRating } from "@/lib/reviews";

export const revalidate = 60;

export async function generateStaticParams() {
  try {
    const events = await getAllEvents();
    return events.map((e: { id: string }) => ({ id: e.id }));
  } catch {
    return [];
  }
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await getPublicEventById(id);
  if (!found) notFound();

  const event = toUserEvent(found);
  const bannerUrl = event.image;
  const prizePool = parsePrizePool(found.extras);
  const today = todayIso();
  const drops = (event.ticketDrops ?? []).map((drop) => {
    const closes = drop.closes || drop.date;
    return { ...drop, closes, isClosed: !!closes && closes < today };
  });
  const organiserReviews = await getPublishedOrganiserReviews(event.organiserId);
  const organiserRating =
    event.organiser?.rating ??
    (() => {
      const avg = averageOverallRating(organiserReviews);
      return avg != null ? { average: avg, count: organiserReviews.length } : null;
    })();
  const organiserName = event.organizer ?? event.organiser?.orgName ?? "Organiser";

  return (
    <main className="min-h-screen bg-dark-darker pt-14">

      {/* ── Banner ── */}
      <div className="relative overflow-hidden w-full" style={{ aspectRatio: "4/3", maxHeight: "420px" }}>
        <Image src={bannerUrl} alt={event.title} fill className="object-cover" sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-darker via-dark-darker/50 to-transparent" />

        {/* Title overlaid at bottom of banner */}
        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 pb-5">
          <span className="inline-block font-headline text-[10px] font-bold uppercase tracking-widest bg-primary text-dark px-3 py-1 rounded-full mb-3">
            {formatDiscipline(event.discipline)}
          </span>
          <h1 className="font-headline text-[28px] sm:text-4xl lg:text-5xl font-black italic tracking-tighter text-light leading-tight mb-2">
            {event.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 font-headline text-xs font-medium uppercase tracking-widest text-muted">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              {event.location}, {STATE_LABELS[event.state]}
            </span>
            <span className="flex items-center gap-1.5 font-headline text-xs font-medium uppercase tracking-widest text-muted">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              {event.endDate && event.endDate !== event.date
                ? formatEventDateRange(event.date, event.endDate)
                : formatEventDate(event.date)}
            </span>
          </div>
        </div>
      </div>

      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Link
          href="/events"
          className="inline-flex items-center gap-2 font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors mb-6"
        >
          &larr; Back to Events
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

          {/* ── Main content — after the details card on mobile, first on desktop ── */}
          <div className="order-2 lg:order-none lg:col-span-2 space-y-6 sm:space-y-8">

            <div>
              <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-3">Event Overview</h2>
              <div
                className="text-sm font-medium text-muted leading-relaxed
                  [&_h3]:font-headline [&_h3]:font-black [&_h3]:text-base [&_h3]:text-light [&_h3]:mt-4 [&_h3]:mb-1
                  [&_h4]:font-headline [&_h4]:font-bold [&_h4]:text-sm [&_h4]:text-light [&_h4]:mt-3 [&_h4]:mb-1
                  [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_li]:mb-0.5"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(event.description) }}
              />
            </div>

            {prizePool && (
              <div className="bg-dark rounded-xl px-5 sm:px-6 py-5 flex items-center gap-4">
                <Trophy className="w-7 h-7 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="font-headline text-xl font-black text-primary leading-tight">
                    ${prizePool.amount} prize pool
                  </p>
                  {prizePool.details && (
                    <p className="font-headline text-[11px] font-medium uppercase tracking-widest text-muted mt-1">
                      {prizePool.details}
                    </p>
                  )}
                </div>
              </div>
            )}

            {drops.length > 0 && (
              <div>
                <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-3">Pricing</h2>
                <div className="space-y-2">
                  {drops.map((drop, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between bg-dark rounded-xl px-4 sm:px-6 py-4 ${
                        drop.isClosed ? "opacity-50" : ""
                      }`}
                    >
                      <div>
                        <p className="font-headline text-sm font-bold text-light flex items-center gap-2 flex-wrap">
                          {drop.label || "General admission"}
                          {drop.isClosed && (
                            <span className="font-headline text-[9px] font-bold uppercase tracking-widest text-muted border border-dark-lighter px-2 py-0.5 rounded-full">
                              Closed
                            </span>
                          )}
                        </p>
                        {drop.startTime && (
                          <p className="font-headline text-xs text-muted uppercase tracking-widest mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Wave start {formatTime(drop.startTime)}
                          </p>
                        )}
                        {drop.closes && (
                          <p className="font-headline text-xs text-muted uppercase tracking-widest mt-0.5">
                            {drop.isClosed ? "Closed" : "Closes"} {formatLongDate(drop.closes)}
                          </p>
                        )}
                      </div>
                      <span className={`font-headline text-2xl font-black italic ${drop.isClosed ? "text-muted line-through" : "text-primary"}`}>
                        {drop.price === "0" ? "Free" : `$${drop.price}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {event.photos && event.photos.length > 0 && (
              <div>
                <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-3">Gallery</h2>
                <EventGallery images={event.photos} title={event.title} />
              </div>
            )}

            <EventReviewsSection
              organiserId={event.organiserId}
              organiserName={organiserName}
              rating={organiserRating}
              reviews={organiserReviews}
            />

          </div>

          {/* ── Sidebar: CTAs + details — first on mobile so key facts aren't buried ── */}
          <div className="order-1 lg:order-none space-y-4">
            {/* CTAs — top of sidebar so they're visible above the fold on desktop; hidden on mobile (sticky bar instead) */}
            <div className="hidden lg:flex flex-col gap-3">
              {event.registrationType === "startline" && event.ticketDrops && event.ticketDrops.length > 0 && (
                <Button asChild variant="machined" size="ctaLg">
                  <Link href={`/events/${event.id}/register`}>
                    Register Now
                    <Ticket className="w-4 h-4" />
                  </Link>
                </Button>
              )}
              {event.registrationUrl && (
                <Button asChild variant="machined" size="ctaLg">
                  <a href={event.registrationUrl ?? undefined} target="_blank" rel="noopener noreferrer">
                    Register Now
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              )}
              <Button asChild variant="outline" size="ctaLg">
                <Link href={`https://maps.google.com/?q=${encodeURIComponent(
                  (event.address || event.location) + ", " + event.city + ", Australia"
                )}`} target="_blank" rel="noopener noreferrer">
                  <MapPin className="w-4 h-4" />
                  View on Maps
                </Link>
              </Button>
            </div>

            <div className="bg-dark rounded-xl p-5 sm:p-6">
              <h3 className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-4">Event Details</h3>
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-0.5">Date</p>
                  <p className="font-headline text-base font-black italic text-light">
                    {event.endDate && event.endDate !== event.date
                      ? formatEventDateRange(event.date, event.endDate)
                      : formatEventDate(event.date)}
                  </p>
                </div>
                <div>
                  <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-0.5">Time</p>
                  <p className="font-headline text-base font-black italic text-light">
                    {formatTime(event.time)}
                    {event.endTime && ` — ${formatTime(event.endTime)}`}
                  </p>
                </div>
                <div>
                  <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-0.5">Location</p>
                  <p className="font-headline text-base font-black italic text-light">{event.location}</p>
                  {event.address && (
                    <p className="font-headline text-xs text-muted uppercase tracking-widest mt-0.5">{event.address}</p>
                  )}
                  <p className="font-headline text-xs text-muted uppercase tracking-widest mt-0.5">{event.city}, {STATE_LABELS[event.state]}</p>
                </div>
                <div>
                  <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-0.5">Format</p>
                  <p className="font-headline text-base font-black italic text-light">{formatCompetitionFormat(event.format)}</p>
                </div>
                {event.categories && event.categories.length > 0 && (
                  <div>
                    <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-1">Divisions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {event.categories.map((c) => (
                        <span key={c} className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/30 bg-primary/10 px-2 py-1 rounded-md">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-0.5">Intensity</p>
                  <p className="font-headline text-base font-black italic text-light">{formatLevel(event.level)}</p>
                </div>
                {((event.cap != null && event.cap > 0) || event.minAge != null) && (
                  <div className="grid grid-cols-2 gap-3">
                    {event.cap != null && event.cap > 0 && (
                      <div>
                        <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-0.5">Participant Cap</p>
                        <p className="font-headline text-base font-black italic text-light">{event.cap.toLocaleString()}</p>
                      </div>
                    )}
                    {event.minAge != null && (
                      <div>
                        <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-0.5">Minimum Age</p>
                        <p className="font-headline text-base font-black italic text-light">
                          {event.minAge === 0 ? "All ages" : `${event.minAge}+`}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {event.organizer && (
                  <div>
                    <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-1.5">Organiser</p>
                    <Link
                      href={`/organisers/${event.organiserId}`}
                      className="group flex items-center gap-3 -mx-2 px-2 py-2 rounded-lg border border-transparent hover:border-primary/40 hover:bg-white/[0.03] transition-colors"
                    >
                      <span className="relative w-10 h-10 rounded-lg overflow-hidden bg-dark-lighter shrink-0">
                        {event.organiser?.logoUrl ? (
                          <Image src={event.organiser.logoUrl} alt={`${event.organizer} logo`} fill className="object-cover" sizes="40px" />
                        ) : (
                          <span className="w-full h-full flex items-center justify-center font-headline text-base font-black italic text-primary">
                            {event.organizer.charAt(0)}
                          </span>
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-headline text-base font-black italic text-light group-hover:text-primary transition-colors leading-tight truncate">
                          {event.organizer}
                        </span>
                        <span className="flex items-center gap-2 mt-0.5">
                          <OrganiserRating rating={organiserRating} />
                          <span className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted">
                            View profile &rarr;
                          </span>
                        </span>
                      </span>
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {event.refundPolicy && (
              <div className="bg-dark rounded-xl p-5 sm:p-6">
                <h3 className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-2">Refund &amp; Transfer Policy</h3>
                <p className="text-sm font-medium text-muted leading-relaxed">{event.refundPolicy}</p>
              </div>
            )}

          </div>
        </div>
      </section>

      {/* ── Mobile sticky bottom CTA bar ── */}
      {(event.registrationUrl || (event.registrationType === "startline" && event.ticketDrops && event.ticketDrops.length > 0)) && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-dark-darker border-t border-dark-lighter px-4 py-3 safe-area-bottom">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              {event.ticketDrops && event.ticketDrops.length > 0 && (
                <>
                  <p className="font-headline text-[10px] uppercase tracking-widest text-muted">From</p>
                  <p className="font-headline text-xl font-black italic text-primary leading-none">
                    {event.fromPrice === 0 ? "Free" : `$${event.fromPrice ?? event.ticketDrops[0].price}`}
                  </p>
                </>
              )}
            </div>
            {event.registrationType === "startline" ? (
              <Link
                href={`/events/${event.id}/register`}
                className="flex items-center justify-center gap-2 bg-primary text-dark font-headline text-sm font-black uppercase tracking-widest px-6 h-12 rounded-xl flex-shrink-0 active:scale-[0.97] transition-transform"
              >
                Register Now
                <Ticket className="w-4 h-4" />
              </Link>
            ) : (
              <a
                href={event.registrationUrl ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-primary text-dark font-headline text-sm font-black uppercase tracking-widest px-6 h-12 rounded-xl flex-shrink-0 active:scale-[0.97] transition-transform"
              >
                Register Now
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Spacer so sticky bar doesn't cover content on mobile */}
      {(event.registrationUrl || (event.registrationType === "startline" && event.ticketDrops && event.ticketDrops.length > 0)) && <div className="lg:hidden h-20" />}

    </main>
  );
}
