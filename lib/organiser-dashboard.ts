export type DashboardEventInput = {
  id: string;
  status: string;
  eventDate: string;
  cap: number | null;
};

export type DashboardRegistrationInput = {
  eventId: string;
  amountCents: number;
  platformFeeCents: number;
  createdAt: Date | string;
};

/** Local calendar day as YYYY-MM-DD. */
export function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseEventDate(eventDate: string): Date | null {
  if (!eventDate) return null;
  const d = new Date(`${eventDate}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isWithinNextDays(eventDate: string, days: number, now = new Date()): boolean {
  const d = parseEventDate(eventDate);
  if (!d) return false;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return d >= start && d <= end;
}

export function computeCapacityFilledPct(
  events: DashboardEventInput[],
  confirmedByEvent: Map<string, number>,
): number | null {
  let filled = 0;
  let capTotal = 0;
  for (const e of events) {
    if (e.status !== "APPROVED" || e.cap == null || e.cap <= 0) continue;
    capTotal += e.cap;
    filled += confirmedByEvent.get(e.id) ?? 0;
  }
  if (capTotal === 0) return null;
  return Math.min(100, Math.round((filled / capTotal) * 100));
}

export function buildTrendDays(
  registrations: DashboardRegistrationInput[],
  days = 30,
  now = new Date(),
): { date: string; registrations: number; revenueCents: number }[] {
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));

  const buckets = new Map<string, { registrations: number; revenueCents: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    buckets.set(toDayKey(d), { registrations: 0, revenueCents: 0 });
  }

  for (const r of registrations) {
    const created = typeof r.createdAt === "string" ? new Date(r.createdAt) : r.createdAt;
    if (Number.isNaN(created.getTime())) continue;
    const key = toDayKey(created);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.registrations += 1;
    bucket.revenueCents += Math.max(0, r.amountCents - r.platformFeeCents);
  }

  return Array.from(buckets.entries()).map(([date, v]) => ({
    date,
    registrations: v.registrations,
    revenueCents: v.revenueCents,
  }));
}

export function computeCurrentStats(
  events: DashboardEventInput[],
  confirmedByEvent: Map<string, number>,
  now = new Date(),
) {
  const liveEvents = events.filter((e) => e.status === "APPROVED");
  let liveRegistrations = 0;
  for (const e of liveEvents) {
    liveRegistrations += confirmedByEvent.get(e.id) ?? 0;
  }

  return {
    live: liveEvents.length,
    racingIn30Days: liveEvents.filter((e) => isWithinNextDays(e.eventDate, 30, now)).length,
    capacityFilledPct: computeCapacityFilledPct(events, confirmedByEvent),
    liveRegistrations,
  };
}

export function formatAudFromCents(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: dollars >= 1000 ? 0 : 2,
  }).format(dollars);
}
