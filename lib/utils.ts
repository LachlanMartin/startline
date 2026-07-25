import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, isAfter, isBefore, startOfDay, addMonths, endOfMonth } from "date-fns";
import type { UserEvent, FilterState, SortOption, ExperienceLevel } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEventDate(dateString: string): string {
  return format(parseISO(dateString), "EEEE, d MMMM yyyy");
}

export function formatShortDate(dateString: string): string {
  return format(parseISO(dateString), "d MMM");
}

export function formatMediumDate(dateString: string): string {
  return format(parseISO(dateString), "d MMM yyyy");
}

export function formatLongDate(dateString: string): string {
  return format(parseISO(dateString), "d MMMM yyyy");
}

export function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export function formatCompetitionFormat(format: string): string {
  if (format === "team") return "Team";
  if (format === "both") return "Individual & Team";
  return "Individual";
}

const LEVEL_LABELS: Record<string, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  extreme: "Extreme",
  open: "Open",
  beginner: "Beginner",
  elite: "Elite",
};

export function formatLevel(level: string): string {
  return LEVEL_LABELS[level.toLowerCase()] ?? "Open";
}

const DISCIPLINE_LABELS: Record<string, string> = {
  crossfit: "CrossFit",
  running: "Running",
  hybrid: "Hybrid",
  cycling: "Cycling",
  swimming: "Swimming",
  triathlon: "Triathlon",
  other: "Other",
};

export function formatDiscipline(discipline: string): string {
  const d = discipline.toLowerCase();
  if (DISCIPLINE_LABELS[d]) return DISCIPLINE_LABELS[d];
  // title-case unknown values, e.g. "functional_fitness" → "Functional Fitness"
  return d
    .split(/[_\-\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatEventDateRange(start: string, end?: string): string {
  if (!end || end === start) return formatEventDate(start);
  const s = parseISO(start);
  const e = parseISO(end);
  if (format(s, "yyyy") !== format(e, "yyyy")) {
    return `${format(s, "d MMMM yyyy")} — ${format(e, "d MMMM yyyy")}`;
  }
  if (format(s, "MM") === format(e, "MM")) {
    return `${format(s, "d")}–${format(e, "d MMMM yyyy")}`;
  }
  return `${format(s, "d MMMM")} — ${format(e, "d MMMM yyyy")}`;
}

function isOnOrAfterToday(dateString: string, today: Date): boolean {
  const eventDate = parseISO(dateString);
  return isAfter(eventDate, today) ||
    format(eventDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
}

export function filterEvents(
  events: UserEvent[],
  filters: FilterState
): UserEvent[] {
  const today = startOfDay(new Date());

  return events.filter((event) => {
    const eventDate = startOfDay(parseISO(event.date));

    if (isBefore(eventDate, today)) return false;

    if (filters.types.length > 0 && !filters.types.includes(event.type)) return false;
    if (filters.states.length > 0 && !filters.states.includes(event.state)) return false;

    if (filters.formats.length > 0) {
      const compatible = filters.formats.some((f) => {
        if (f === "individual" && event.format === "team")      return false;
        if (f === "team"       && event.format === "individual") return false;
        return true;
      });
      if (!compatible) return false;
    }

    if (filters.levels.length > 0 && !filters.levels.includes(event.level as ExperienceLevel)) return false;

    if (filters.priceRange && event.fromPrice !== null) {
      const [min, max] = filters.priceRange;
      if (event.fromPrice < min || event.fromPrice > max) return false;
    }

    if (filters.dateRange === "this-month") {
      if (isAfter(eventDate, endOfMonth(today))) return false;
    } else if (filters.dateRange === "next-3") {
      if (isAfter(eventDate, addMonths(today, 3))) return false;
    }

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const matches =
        event.title.toLowerCase().includes(q) ||
        event.location.toLowerCase().includes(q) ||
        event.city.toLowerCase().includes(q) ||
        (event.organizer?.toLowerCase().includes(q) ?? false);
      if (!matches) return false;
    }

    return true;
  });
}

export function sortEventsByDate(events: UserEvent[]): UserEvent[] {
  return [...events].sort(
    (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );
}

export function sortEvents(events: UserEvent[], sortBy: SortOption): UserEvent[] {
  switch (sortBy) {
    case "price-asc":
      return [...events].sort((a, b) => (a.fromPrice ?? Infinity) - (b.fromPrice ?? Infinity));
    case "price-desc":
      return [...events].sort((a, b) => (b.fromPrice ?? -Infinity) - (a.fromPrice ?? -Infinity));
    case "popular":
      return [...events].sort((a, b) => b.registrationCount - a.registrationCount);
    case "date":
    default:
      return sortEventsByDate(events);
  }
}

export function getUpcomingEvents(events: UserEvent[], limit = 10): UserEvent[] {
  const today = startOfDay(new Date());
  const upcoming = events.filter((e) => isOnOrAfterToday(e.date, today));
  return sortEventsByDate(upcoming).slice(0, limit);
}

/** Past events (before today), most recent first. */
export function getPastEvents(events: UserEvent[], limit = 20): UserEvent[] {
  const today = startOfDay(new Date());
  const past = events.filter((e) => isBefore(startOfDay(parseISO(e.date)), today));
  return [...past]
    .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())
    .slice(0, limit);
}

export function getTotalUpcomingEvents(events: UserEvent[]): number {
  const today = startOfDay(new Date());
  return events.filter((e) => isOnOrAfterToday(e.date, today)).length;
}

/** Flatten rich-text HTML (organiser descriptions) to plain text for card previews. */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&[^;\s]+;/g, " ").replace(/\s+/g, " ").trim();
}

export function truncateTitle(title: string, maxLength = 28): string {
  if (title.length <= maxLength) return title;
  return title.slice(0, maxLength).trimEnd() + "…";
}
