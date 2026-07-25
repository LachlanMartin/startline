export type EventType =
  | "crossfit"
  | "running"
  | "hybrid"
  | "swimming"
  | "cycling"
  | "triathlon";

export type AustralianState =
  | "nsw"
  | "vic"
  | "qld"
  | "wa"
  | "sa"
  | "tas"
  | "act"
  | "nt";

export type CompetitionFormat =
  | "individual"
  | "team"
  | "both";

export type ExperienceLevel =
  | "open"
  | "beginner"
  | "elite";

export interface TicketDrop {
  label: string;
  date?: string;
  price?: string;
  qty?: number;
  closes?: string;
  startTime?: string;
}

export interface UserEvent {
  id: string;
  title: string;
  description: string;
  fullDescription?: string;
  date: string;
  endDate?: string;
  time: string;
  endTime?: string;
  dates?: string[];
  location: string;
  address?: string;
  city: string;
  state: AustralianState;
  type: EventType;
  discipline: string;
  format: string;
  level: string;
  categories?: string[];
  cap?: number | null;
  minAge?: number | null;
  refundPolicy?: string;
  image: string;
  registrationUrl: string | null;
  registrationType: string;
  feeStructure: string;
  organiserId: string;
  organizer?: string;
  distance?: string;
  isOfficial?: boolean;
  ticketDrops?: TicketDrop[];
  fromPrice: number | null;
  tagline?: string | null;
  coverImageUrl?: string | null;
  photos?: string[];
  registrationCount: number;
  organiser?: {
    id: string;
    orgName: string | null;
    logoUrl: string | null;
    rating?: { average: number; count: number } | null;
  };
}

export interface FilterState {
  types: EventType[];
  states: AustralianState[];
  formats: CompetitionFormat[];
  levels: ExperienceLevel[];
  priceRange: [number, number] | null;
  dateRange: "this-month" | "next-3" | "all";
  searchQuery: string;
}

export type SortOption = "date" | "price-asc" | "price-desc" | "popular";

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "date",       label: "Date: Soonest" },
  { value: "price-asc",  label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "popular",    label: "Most Popular" },
];

export const PRICE_RANGE_MIN = 0;
export const PRICE_RANGE_MAX = 300;

export interface EventTypeOption {
  value: EventType;
  label: string;
  shortLabel: string;
}

export const EVENT_TYPE_OPTIONS: EventTypeOption[] = [
  { value: "crossfit",       label: "CrossFit Competitions",      shortLabel: "CrossFit" },
  { value: "running",        label: "Running (5K–Marathon)",      shortLabel: "Running" },
  { value: "hybrid",         label: "Hybrid / Obstacle",         shortLabel: "Hybrid" },
  { value: "swimming",       label: "Swimming",                   shortLabel: "Swimming" },
  { value: "cycling",        label: "Cycling",                    shortLabel: "Cycling" },
  { value: "triathlon",      label: "Triathlon",                  shortLabel: "Triathlon" },

];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  crossfit:         "CrossFit",
  running:          "Running",
  hybrid:           "Hybrid",
  swimming:         "Swimming",
  cycling:          "Cycling",
  triathlon:        "Triathlon",

};

export interface StateOption {
  value: AustralianState;
  label: string;
  shortLabel: string;
}

export const STATE_OPTIONS: StateOption[] = [
  { value: "nsw", label: "New South Wales",                shortLabel: "NSW" },
  { value: "vic", label: "Victoria",                       shortLabel: "VIC" },
  { value: "qld", label: "Queensland",                     shortLabel: "QLD" },
  { value: "wa",  label: "Western Australia",              shortLabel: "WA" },
  { value: "sa",  label: "South Australia",                shortLabel: "SA" },
  { value: "tas", label: "Tasmania",                       shortLabel: "TAS" },
  { value: "act", label: "Australian Capital Territory",   shortLabel: "ACT" },
  { value: "nt",  label: "Northern Territory",             shortLabel: "NT" },
];

export const STATE_LABELS: Record<AustralianState, string> = {
  nsw: "NSW",
  vic: "VIC",
  qld: "QLD",
  wa:  "WA",
  sa:  "SA",
  tas: "TAS",
  act: "ACT",
  nt:  "NT",
};

export const FORMAT_OPTIONS = [
  { value: "individual", label: "Individual" },
  { value: "team",       label: "Team / Pairs" },
  { value: "both",       label: "Individual & Team" },
] as const;

export const LEVEL_OPTIONS: { value: ExperienceLevel; label: string }[] = [
  { value: "open",     label: "Open" },
  { value: "beginner", label: "Beginner" },
  { value: "elite",    label: "Elite" },
];

export const DATE_RANGE_OPTIONS = [
  { value: "this-month", label: "This Month" },
  { value: "next-3",     label: "Next 3 Months" },
  { value: "all",        label: "All Upcoming" },
] as const;

// backward compat for utils.ts

