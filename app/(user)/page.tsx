import { getAllEvents } from "@/lib/events";
import { toUserEvents } from "@/lib/user-events";
import { getUserSession } from "@/lib/amplify-server";
import prisma from "@/lib/prisma";
import HeroCarousel from "@/components/HeroCarousel";
import HeroSearch from "@/components/HeroSearch";
import EventCard from "@/components/EventCard";
import VerifiedBanner from "@/components/VerifiedBanner";
import { ScrollCarousel } from "@/components/ui/ScrollCarousel";
import type { UserEvent } from "@/types";

export const revalidate = 60;

function sortByDate(events: UserEvent[]): UserEvent[] {
  return [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export default async function Home() {
  const raw = await getAllEvents();
  const events = toUserEvents(raw);

  // ── Starting Soon (next upcoming events) ──
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = sortByDate(events.filter((e) => new Date(e.date) >= today));
  const startingSoon = upcoming.slice(0, 12);

  // ── Recommended For You ──
  let recommended = events;
  try {
    const session = await getUserSession();
    if (session) {
      const user = await prisma.user.findUnique({
        where: { id: session.sub },
        select: { city: true, state: true },
      });
      if (user?.state) {
        const local = events.filter((e) => e.state === user.state);
        if (local.length >= 3) recommended = local;
      }
    }
  } catch {
    // not authenticated — show all
  }

  return (
    <main className="min-h-screen bg-dark-darker">
      <VerifiedBanner />

      {/* ── Hero ── */}
      {/* No overflow-hidden here: it would clip the search bar's suggestion
          dropdown at the section's bottom edge. The carousel clips itself. */}
      <section className="relative min-h-[520px] sm:min-h-[600px] flex items-end">
        <HeroCarousel />
        <div className="relative z-10 w-full max-w-[1440px] mx-auto px-4 sm:px-6 pt-20 pb-8 sm:pb-12">
          <p className="font-headline text-[10px] sm:text-xs font-black uppercase tracking-widest text-primary mb-3">
            Australia&apos;s Fitness Event Calendar
          </p>
          <h1 className="font-headline text-[44px] sm:text-6xl lg:text-8xl font-black italic leading-none tracking-tighter mb-3">
            Find Your <span className="text-primary">Start Line.</span>
          </h1>
          <p className="font-headline text-sm sm:text-base font-medium text-muted max-w-xl leading-relaxed">
            Search, filter and register for fitness events across Australia.
          </p>
          <HeroSearch />
        </div>
      </section>

      {/* ── Trending Now ── */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-6 sm:pb-8">
        <ScrollCarousel
          eyebrow="Trending Now"
          title="Most Popular Events"
        >
          {events.map((event) => <EventCard key={event.id} event={event} />)}
        </ScrollCarousel>
      </section>

      {/* ── Starting Soon ── */}
      {startingSoon.length > 0 && (
        <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <ScrollCarousel
            eyebrow="Coming Up"
            title="Starting Soon"
          >
            {startingSoon.map((event) => <EventCard key={event.id} event={event} />)}
          </ScrollCarousel>
        </section>
      )}

      {/* ── Recommended For You ── */}
      {recommended.length > 0 && (
        <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-16 sm:pb-20">
          <ScrollCarousel
            eyebrow="Personalised"
            title="Recommended For You"
          >
            {recommended.map((event) => <EventCard key={event.id} event={event} />)}
          </ScrollCarousel>
        </section>
      )}

    </main>
  );
}
