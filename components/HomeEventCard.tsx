import Link from "next/link";
import Image from "next/image";
import { MapPin, Clock, Users } from "lucide-react";
import type { UserEvent } from "@/types";
import { EVENT_TYPE_LABELS, STATE_LABELS } from "@/types";
import { cn, formatShortDate, formatTime, formatCompetitionFormat, stripHtml } from "@/lib/utils";
import OrganiserCardMeta from "@/components/OrganiserCardMeta";

export default function HomeEventCard({ event, className }: { event: UserEvent; className?: string }) {
  const [day, month] = formatShortDate(event.date).split(" ");
  const img = event.image;
  const typeLabel = EVENT_TYPE_LABELS[event.type];
  const organiserName = event.organizer ?? event.organiser?.orgName ?? null;

  return (
    <Link
      href={`/events/${event.id}`}
      className={cn(
        "group flex flex-col self-stretch",
        className ?? "flex-shrink-0 w-[280px] sm:w-[340px]"
      )}
      style={{ scrollSnapAlign: "start" }}
    >
      <div className="h-full flex flex-col bg-dark border border-dark-lighter rounded-2xl group-hover:-translate-y-1 group-hover:border-primary/40 group-hover:shadow-xl group-hover:shadow-black/50 transition-all duration-300 transform-gpu">

        {/* Image */}
        <div className="relative w-full aspect-video overflow-hidden rounded-t-2xl shrink-0">
          <Image
            src={img}
            alt={event.title}
            fill
            className="pointer-events-none object-cover brightness-[0.55] group-hover:brightness-[0.65] group-hover:scale-105 transition-all duration-700"
            sizes="(max-width: 640px) 100vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-dark/60 via-transparent to-transparent" />

          {/* Date badge */}
          <div className="absolute top-3 right-3 bg-dark-light/90 backdrop-blur-sm rounded-lg px-3 py-2 text-center leading-tight">
            <span className="block font-headline text-[9px] font-bold uppercase tracking-widest text-muted">{month}</span>
            <span className="block font-headline text-xl font-black text-light leading-none mt-0.5">{day}</span>
          </div>
        </div>

        {/* Content — flex column so price anchors to the bottom across cards */}
        <div className="p-4 flex flex-col flex-1 min-h-0">
          <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">
            {typeLabel}
          </span>
          <h3 className="font-headline text-lg sm:text-xl font-black italic tracking-tighter text-light group-hover:text-primary transition-colors leading-tight mb-3 line-clamp-2">
            {event.title}
          </h3>

          <div className="space-y-1.5 mb-3">
            <div className="flex items-center gap-2 font-headline text-[10px] font-medium uppercase tracking-widest text-muted">
              <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
              <span className="truncate">{event.city}, {STATE_LABELS[event.state]}</span>
            </div>
            <div className="flex items-center gap-2 font-headline text-[10px] font-medium uppercase tracking-widest text-muted">
              <Clock className="w-3 h-3 text-primary flex-shrink-0" />
              <span>{formatTime(event.time)}</span>
            </div>
            <div className="flex items-center gap-2 font-headline text-[10px] font-medium uppercase tracking-widest text-muted">
              <Users className="w-3 h-3 text-primary flex-shrink-0" />
              <span>{formatCompetitionFormat(event.format)}</span>
            </div>
          </div>

          {organiserName && (
            <OrganiserCardMeta
              organiserId={event.organiserId}
              name={organiserName}
              rating={event.organiser?.rating}
              nestedInLink
              className="mb-3"
            />
          )}

          {event.description && (
            <p className="font-headline text-xs text-muted leading-relaxed line-clamp-2 mb-3">
              {stripHtml(event.description)}
            </p>
          )}

          {event.fromPrice !== null && (
            <span className="mt-auto pt-1 font-headline text-sm font-bold text-primary">
              From ${event.fromPrice}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
