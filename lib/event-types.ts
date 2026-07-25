export interface PublicWave {
  label: string;
  date?: string;
  price?: string;
  qty?: number;
  closes?: string;
  startTime?: string;
}

export interface PublicEvent {
  id: string;
  title: string;
  discipline: string;
  tagline: string | null;
  description: string | null;
  eventDate: string;
  endDate: string | null;
  startTime: string;
  endTime: string;
  venue: string;
  address: string | null;
  city: string;
  state: string;
  format: string;
  level: string;
  categories: unknown;
  cap: number | null;
  minAge: number | null;
  waves: unknown;
  extras: string | null;
  refundPolicy: string | null;
  coverImageUrl: string | null;
  photos: string[];
  registrationType: string;
  registrationUrl: string | null;
  feeStructure: string;
  fromPrice: number | null;
  registrationCount: number;
  organiserId: string;
  organiser: {
    id: string;
    orgName: string | null;
    logoUrl: string | null;
    stripeAccountId: string | null;
    stripeOnboardingComplete: boolean;
    rating?: { average: number; count: number } | null;
  };
}

export function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** A wave is open until the end of its close date (legacy waves store it in `date`). */
export function waveIsOpen(wave: PublicWave, today = todayIso()): boolean {
  const closes = wave?.closes || wave?.date;
  return !closes || closes >= today;
}

/**
 * Lowest advertised price. Only tiers still on sale are considered, so cards
 * and the sticky bar never advertise a closed early-bird price; if every tier
 * has closed, falls back to all tiers so the event still shows a price.
 */
export function lowestPrice(waves: unknown): number | null {
  if (!Array.isArray(waves)) return null;
  const all = waves as PublicWave[];
  const today = todayIso();
  const open = all.filter((w) => waveIsOpen(w, today));
  const prices = (open.length ? open : all)
    .map((w) => parseFloat(w?.price ?? ""))
    .filter((n) => Number.isFinite(n));
  return prices.length ? Math.min(...prices) : null;
}
