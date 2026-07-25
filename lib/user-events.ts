import { type PublicEvent, lowestPrice } from "@/lib/event-types";
import type { UserEvent, TicketDrop, EventType, AustralianState } from "@/types";

function mapDiscipline(discipline: string): EventType {
  const d = discipline.toLowerCase();
  if (d === "crossfit")       return "crossfit";
  if (d === "running")        return "running";
  if (d === "hybrid")         return "hybrid";
  if (d === "swimming")       return "swimming";
  if (d === "cycling")        return "cycling";
  if (d === "triathlon")      return "triathlon";

  return "running";
}

function mapState(state: string): AustralianState {
  const s = state.toLowerCase();
  if (s === "nsw" || s === "new south wales") return "nsw";
  if (s === "vic" || s === "victoria")        return "vic";
  if (s === "qld" || s === "queensland")      return "qld";
  if (s === "wa"  || s === "western australia") return "wa";
  if (s === "sa"  || s === "south australia") return "sa";
  if (s === "tas" || s === "tasmania")        return "tas";
  if (s === "act")                            return "act";
  if (s === "nt"  || s === "northern territory") return "nt";
  return "nsw";
}

function parseWaves(waves: unknown): TicketDrop[] {
  if (!Array.isArray(waves)) return [];
  return waves as TicketDrop[];
}

export function toUserEvent(event: PublicEvent): UserEvent {
  const type = mapDiscipline(event.discipline);
  const waves = event.waves ?? [];
  const ticketDrops = parseWaves(waves);

  return {
    id: event.id,
    title: event.title,
    description: event.description ?? "",
    fullDescription: event.tagline ?? undefined,
    date: event.eventDate,
    endDate: event.endDate ?? undefined,
    time: event.startTime,
    endTime: event.endTime ?? undefined,
    location: event.venue,
    address: event.address ?? undefined,
    city: event.city,
    state: mapState(event.state),
    type,
    discipline: event.discipline,
    format: event.format,
    level: event.level,
    categories: Array.isArray(event.categories)
      ? (event.categories as unknown[]).filter((c): c is string => typeof c === "string")
      : [],
    cap: event.cap,
    minAge: event.minAge,
    refundPolicy: event.refundPolicy?.trim() || undefined,
    // Never fall back to the organiser logo — a logo stretched to 16:9 repeated
    // across every coverless card reads as broken. Use the placeholder instead.
    image: event.coverImageUrl ?? "/images/placeholder-event.svg",
    registrationUrl: event.registrationUrl,
    registrationType: event.registrationType,
    feeStructure: event.feeStructure,
    organiserId: event.organiserId,
    organizer: event.organiser?.orgName ?? undefined,
    distance: undefined,
    isOfficial: false,
    ticketDrops,
    fromPrice: lowestPrice(waves),
    tagline: event.tagline,
    coverImageUrl: event.coverImageUrl,
    photos: Array.isArray(event.photos) ? event.photos : [],
    registrationCount: event.registrationCount,
    organiser: event.organiser
      ? {
          id: event.organiser.id,
          orgName: event.organiser.orgName,
          logoUrl: event.organiser.logoUrl,
          rating: event.organiser.rating ?? null,
        }
      : undefined,
  };
}

export function toUserEvents(events: PublicEvent[]): UserEvent[] {
  return events.map(toUserEvent);
}
