import Link from "next/link";
import Image from "next/image";
import { MapPin, Clock, Users, Calendar } from "lucide-react";
import type { UserEvent } from "@/types";
import { EVENT_TYPE_LABELS, STATE_LABELS } from "@/types";
import { cn, formatMediumDate, formatShortDate, formatTime, formatCompetitionFormat, stripHtml } from "@/lib/utils";
import { getEventStatus } from "@/lib/event-status";
import SaveEventButton from "./SaveEventButton";
import OrganiserCardMeta from "@/components/OrganiserCardMeta";

interface EventCardProps {
  event: UserEvent;
  variant?: "default" | "compact" | "list";
  cardClassName?: string;
}

export default function EventCard({ event, variant = "default", cardClassName }: EventCardProps) {
  const typeLabel  = EVENT_TYPE_LABELS[event.type];
  const stateLabel = STATE_LABELS[event.state];
  const [day, month] = formatShortDate(event.date).split(" ");
  const status = getEventStatus(event);

  if (variant === "compact") {
    return (
      <Link href={`/events/${event.id}`} className="group block">
        <div className="rounded-xl border border-dark-lighter hover:border-primary/40 transition-colors bg-dark overflow-hidden">
          <div className="relative aspect-[16/9] bg-dark-light overflow-hidden">
            <span className="absolute top-2 left-2 z-10 text-[9px] font-headline uppercase tracking-widest bg-primary text-dark px-2 py-0.5 rounded-full">
              {typeLabel}
            </span>
          </div>
          <div className="p-3">
            <h3 className="font-headline text-sm font-bold italic tracking-tighter text-light line-clamp-1 group-hover:text-primary transition-colors">
              {event.title}
            </h3>
            <div className="flex items-center gap-2 mt-1.5 text-[10px] font-medium font-headline uppercase tracking-widest text-muted">
              <Calendar className="w-3 h-3 text-primary" />
              <span>{formatMediumDate(event.date)}</span>
              <span>&middot;</span>
              <span>{stateLabel}</span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  if (variant === "list") {
    return (
      <Link href={`/events/${event.id}`} className="group block">
        <div className="border-b border-dark-lighter px-4 py-4 hover:bg-dark transition-colors">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-12 text-center bg-dark-lighter py-2 px-2">
              <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted">{month}</p>
              <p className="font-headline text-xl font-black text-light">{day}</p>
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-headline text-[9px] uppercase tracking-widest bg-primary text-dark px-2 py-0.5 inline-block mb-1 rounded-full">
                {typeLabel}
              </span>
              <h3 className="font-headline font-bold italic tracking-tighter text-light group-hover:text-primary transition-colors text-sm leading-tight">
                {event.title}
              </h3>
              <div className="flex items-center gap-3 mt-1.5 text-[10px] font-medium font-headline uppercase tracking-widest text-muted">
                <span className="flex items-center gap-1">
                  <MapPin className="w-2.5 h-2.5 text-primary" />
                  {event.city}, {stateLabel}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  const bannerUrl = event.image;

  return (
    <Link href={`/events/${event.id}`} className="block group">
      <div className={cn("rounded-xl flex flex-col h-full ring-1 ring-transparent group-hover:ring-primary transition-all duration-200 bg-dark border border-dark-lighter overflow-hidden", cardClassName)}>
        <div className="relative h-36 sm:h-44 overflow-hidden flex-shrink-0">
          <Image
            src={bannerUrl}
            alt={event.title}
            fill
            className="pointer-events-none object-cover transition-all duration-500 brightness-50 group-hover:brightness-60"
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/40 to-transparent" />

          <div className="absolute inset-x-0 top-0 p-3 flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className={`font-headline text-[10px] font-medium uppercase tracking-widest px-2.5 py-1 rounded-full ${status.style}`}>
                {status.label}
              </span>
              <SaveEventButton eventId={event.id} className="bg-dark/60 backdrop-blur-sm" />
            </div>
            <div className="bg-dark/80 backdrop-blur-sm px-3 py-1.5 text-right flex-shrink-0">
              <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted leading-none mb-0.5">{month}</p>
              <p className="font-headline text-xl font-black text-light leading-none">{day}</p>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-3">
            <span className="font-headline text-[10px] font-medium uppercase tracking-widest text-primary mb-1 inline-block">
              {typeLabel}
            </span>
            <h3 className="font-headline text-xl sm:text-2xl font-black italic tracking-tighter text-light group-hover:text-primary transition-colors duration-200 leading-tight">
              {event.title}
            </h3>
          </div>
        </div>

        <div className="p-4 flex flex-col flex-1">
          <div className="space-y-1.5 mb-3">
            <div className="flex items-center gap-2 font-headline text-[10px] font-medium uppercase tracking-widest text-muted">
              <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
              <span className="truncate">{event.location}, {stateLabel}</span>
            </div>
            <div className="flex items-center gap-2 font-headline text-[10px] font-medium uppercase tracking-widest text-muted">
              <Clock className="w-3 h-3 text-primary flex-shrink-0" />
              <span>{formatTime(event.time)}</span>
              {event.endTime && <span>&mdash; {formatTime(event.endTime)}</span>}
            </div>
            <div className="flex items-center gap-2 font-headline text-[10px] font-medium uppercase tracking-widest text-muted">
              <Users className="w-3 h-3 text-primary flex-shrink-0" />
              <span>{formatCompetitionFormat(event.format)}</span>
            </div>
          </div>
          <p className="text-xs sm:text-sm font-medium text-muted border-l-2 border-dark-lighter pl-3 line-clamp-2 flex-1">
            {stripHtml(event.description)}
          </p>
          {(event.organizer || event.organiser?.orgName) && (
            <OrganiserCardMeta
              organiserId={event.organiserId}
              name={event.organizer ?? event.organiser!.orgName!}
              rating={event.organiser?.rating}
              className="mt-3"
              nestedInLink
            />
          )}
        </div>
      </div>
    </Link>
  );
}
