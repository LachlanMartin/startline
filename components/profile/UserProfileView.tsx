import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { parseISO } from "date-fns";
import { MapPin, Timer, ArrowUpRight } from "lucide-react";
import { STATE_LABELS } from "@/types";
import type { AustralianState } from "@/types";
import { formatDiscipline, formatShortDate, cn } from "@/lib/utils";
import OrganiserIdentity from "@/components/OrganiserIdentity";
import type { OrganiserRating } from "@/lib/reviews";

export type ProfileRaceHistory = {
  completed: number;
  registrations: {
    id: string;
    finishTime: string | null;
    result: string | null;
    event: {
      id: string;
      title: string;
      discipline: string;
      eventDate: string;
      city: string;
      state: string;
      coverImageUrl: string | null;
      organiser: {
        id: string;
        orgName: string | null;
        logoUrl: string | null;
        rating: OrganiserRating | null;
      };
    };
  }[];
};

export type UserProfileViewProps = {
  username: string;
  bio: string | null;
  profilePicUrl: string | null;
  coverImageUrl: string | null;
  coverPosition: string | null;
  history: ProfileRaceHistory | null;
  /** Optional actions rendered beside stats (e.g. Edit Profile). */
  headerActions?: ReactNode;
  loading?: boolean;
};

function formatCount(n: number) {
  return n.toLocaleString("en-AU");
}

function ProfileStats({ completed }: { completed: number }) {
  return (
    <div className="text-center">
      <div className="font-headline text-xl sm:text-2xl font-black tracking-tighter text-light leading-none">
        {formatCount(completed)}
      </div>
      <div className="font-headline text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-light mt-1">
        Events Completed
      </div>
    </div>
  );
}

type HistoryRegistration = ProfileRaceHistory["registrations"][number];

function groupHistoryByYear(registrations: HistoryRegistration[]) {
  const sorted = [...registrations].sort(
    (a, b) => parseISO(b.event.eventDate).getTime() - parseISO(a.event.eventDate).getTime(),
  );
  const groups: { year: number; registrations: HistoryRegistration[] }[] = [];
  for (const reg of sorted) {
    const year = parseISO(reg.event.eventDate).getFullYear();
    const last = groups[groups.length - 1];
    if (last && last.year === year) {
      last.registrations.push(reg);
    } else {
      groups.push({ year, registrations: [reg] });
    }
  }
  return groups;
}

function RaceHistoryCard({ reg }: { reg: HistoryRegistration }) {
  const [day, month] = formatShortDate(reg.event.eventDate).split(" ");
  const location = `${reg.event.city}, ${STATE_LABELS[reg.event.state as AustralianState]}`;
  const hasResult = Boolean(reg.result || reg.finishTime);

  return (
    <Link
      href={`/events/${reg.event.id}`}
      className={cn(
        "group relative grid grid-cols-1 md:grid-cols-[140px_minmax(0,1fr)] xl:grid-cols-[160px_minmax(0,1fr)_340px]",
        "bg-dark border border-dark-lighter rounded-2xl overflow-hidden",
        "transition-all duration-200 ease-[cubic-bezier(0.2,0.7,0.2,1)]",
        "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
      )}
    >
      <div className="relative h-28 md:h-auto md:min-h-[120px] bg-dark-light overflow-hidden">
        {reg.event.coverImageUrl ? (
          <Image
            src={reg.event.coverImageUrl}
            alt=""
            fill
            className="object-cover brightness-[0.58] saturate-110 transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 160px"
          />
        ) : (
          <div className="absolute inset-0 placeholder-stripes opacity-40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-dark via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-dark/40" />
        <div className="absolute top-2.5 left-2.5 md:top-3 md:left-3 bg-dark-light/90 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-center leading-tight">
          <span className="block font-headline text-[9px] font-bold uppercase tracking-widest text-muted">
            {month}
          </span>
          <span className="block font-headline text-xl font-black text-light leading-none mt-0.5">
            {day}
          </span>
        </div>
      </div>

      <div className="flex flex-col justify-center gap-1.5 p-4 sm:p-5 min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/25 px-2.5 py-1 font-headline text-[10px] font-bold uppercase tracking-widest text-primary">
            {formatDiscipline(reg.event.discipline)}
          </span>
          <span className="flex items-center gap-1.5 font-headline text-xs font-normal uppercase tracking-widest text-light">
            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
            {location}
          </span>
        </div>

        <div className="min-w-0">
          <h3 className="font-headline text-xl sm:text-2xl font-black tracking-tighter text-light group-hover:text-primary transition-colors leading-[1.1]">
            {reg.event.title}
          </h3>
          {reg.event.organiser?.orgName && (
            <div className="mt-1.5">
              <OrganiserIdentity
                organiserId={reg.event.organiser.id}
                name={reg.event.organiser.orgName}
                logoUrl={reg.event.organiser.logoUrl}
                rating={reg.event.organiser.rating}
                nestedInLink
              />
            </div>
          )}
        </div>

        {hasResult && (
          <div className="xl:hidden flex items-center gap-8 pt-1 border-t border-dark-lighter">
            {reg.finishTime && (
              <div>
                <p className="font-headline text-[11px] font-bold uppercase tracking-widest text-light">
                  Finish
                </p>
                <p className="flex items-center gap-1.5 font-headline text-xl font-black tracking-tighter text-light leading-none mt-0.5">
                  <Timer className="w-3.5 h-3.5 text-muted" />
                  {reg.finishTime}
                </p>
              </div>
            )}
            {reg.result && (
              <div>
                <p className="font-headline text-[11px] font-bold uppercase tracking-widest text-light">
                  Result
                </p>
                <p className="font-headline text-xl font-black tracking-tighter text-light leading-none mt-0.5">
                  {reg.result}
                </p>
              </div>
            )}
            <ArrowUpRight className="w-4 h-4 text-muted ml-auto group-hover:text-primary transition-colors" />
          </div>
        )}
      </div>

      <div
        className={cn(
          "hidden xl:flex items-center justify-center relative border-l border-dark-lighter px-5 py-4",
          "scan-grid"
        )}
      >
        {hasResult ? (
          <div className="grid grid-cols-2 gap-x-10 gap-y-2 w-full pr-5">
            {reg.finishTime && (
              <div>
                <p className="font-headline text-[11px] font-bold uppercase tracking-[0.18em] text-light">
                  Finish time
                </p>
                <p className="flex items-center gap-1.5 font-headline text-2xl font-black tracking-tighter text-light leading-none mt-1">
                  <Timer className="w-4 h-4 text-muted shrink-0" />
                  {reg.finishTime}
                </p>
              </div>
            )}
            {reg.result && (
              <div>
                <p className="font-headline text-[11px] font-bold uppercase tracking-[0.18em] text-light">
                  Result
                </p>
                <p className="font-headline text-2xl font-black tracking-tighter text-light leading-none mt-1">
                  {reg.result}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="font-headline text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
              Status
            </p>
            <p className="font-headline text-sm font-bold uppercase tracking-widest text-muted mt-1">
              Completed
            </p>
          </div>
        )}
        <ArrowUpRight className="absolute top-4 right-4 w-4 h-4 text-muted-dark group-hover:text-primary transition-colors" />
      </div>
    </Link>
  );
}

export default function UserProfileView({
  username,
  bio,
  profilePicUrl,
  coverImageUrl,
  coverPosition,
  history,
  headerActions,
  loading = false,
}: UserProfileViewProps) {
  const initial = username[0]?.toUpperCase() ?? "A";
  const completed = history?.completed ?? 0;

  return (
    <main className="min-h-screen bg-dark-darker pt-14">
      <div className="relative w-full h-44 sm:h-60 overflow-hidden">
        {coverImageUrl ? (
          <Image
            src={coverImageUrl}
            alt=""
            fill
            className="object-cover brightness-[0.55]"
            style={{ objectPosition: coverPosition ?? "50% 50%" }}
            sizes="100vw"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-dark via-dark-lighter to-dark-darker" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-darker via-dark-darker/40 to-transparent" />
      </div>

      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 pb-12">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-5 -mt-16 sm:-mt-20 relative z-10">
          {loading ? (
            <>
              <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-2xl bg-dark-lighter animate-pulse shrink-0" />
              <div className="flex-1 space-y-3 pb-1">
                <div className="w-48 h-10 bg-dark-lighter rounded animate-pulse" />
                <div className="w-32 h-3 bg-dark-lighter rounded animate-pulse" />
              </div>
            </>
          ) : (
            <>
              <div className="relative w-36 h-36 sm:w-40 sm:h-40 rounded-2xl overflow-hidden border-2 border-dark-lighter bg-dark shrink-0">
                {profilePicUrl ? (
                  <Image
                    src={profilePicUrl}
                    alt={username}
                    fill
                    className="object-cover"
                    sizes="160px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-headline text-5xl font-black text-primary">
                    {initial}
                  </div>
                )}
              </div>

              <div className="flex flex-1 min-w-0 flex-col sm:flex-row sm:items-end gap-4 sm:gap-5 pb-1">
                <div className="min-w-0 flex flex-wrap items-end gap-x-5 gap-y-2">
                  <h1 className="font-headline text-4xl sm:text-5xl font-black tracking-tighter text-light leading-none">
                    {username}
                  </h1>
                  <ProfileStats completed={completed} />
                  {bio && (
                    <p className="basis-full mt-1 text-lg sm:text-xl font-medium text-light leading-relaxed max-w-3xl sm:hidden">
                      {bio}
                    </p>
                  )}
                </div>

                {headerActions && (
                  <div className="flex items-end sm:ml-auto shrink-0">
                    {headerActions}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {bio && (
          <div className="hidden sm:block mt-6 max-w-3xl">
            <p className="text-lg sm:text-xl font-medium text-light leading-relaxed">{bio}</p>
          </div>
        )}

        <div className="mt-12">
          <div className="mb-6">
            <h2 className="font-headline text-3xl sm:text-4xl font-black tracking-tighter text-light leading-none">
              Race <span className="text-primary">History</span>
            </h2>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="h-36 rounded-2xl bg-dark border border-dark-lighter animate-pulse"
                />
              ))}
            </div>
          ) : history && history.registrations.length > 0 ? (
            <div className="space-y-8">
              {groupHistoryByYear(history.registrations).map(({ year, registrations }) => (
                <div key={year}>
                  <p className="font-headline text-2xl font-black tracking-tighter text-light mb-3">
                    {year}
                  </p>
                  <div className="space-y-4">
                    {registrations.map((reg) => (
                      <RaceHistoryCard key={reg.id} reg={reg} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-dark border border-dashed border-dark-lighter rounded-2xl px-6 py-14 text-center">
              <p className="font-headline text-xl font-black tracking-tighter text-light">
                No races logged yet.
              </p>
              <p className="text-sm text-muted mt-2 max-w-sm mx-auto leading-relaxed">
                Finish an event and your result will land here — placing, time, and the full race story.
              </p>
              <Link
                href="/events"
                className="inline-block mt-5 font-headline text-xs font-bold uppercase tracking-widest text-primary hover:underline"
              >
                Find Events
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
