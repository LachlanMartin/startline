/**
 * Single source of truth for event refund policies.
 *
 * A policy is a list of tiers: "this many days before the event, you get back
 * this percentage". Nothing else in the app parses or formats a policy, so the
 * organiser form, the athlete's checkout and refund dialog, the organiser's
 * refunds tab and the admin console all agree on the numbers and the wording.
 *
 * The percentage applies to the FULL amount the athlete paid — ticket price plus
 * the Startline fee — so "full refund" means what an athlete expects it to mean.
 */

export type RefundTier = {
  /** Refund applies when the entry is cancelled this many days (or more) out. */
  daysBefore: number;
  /** Percentage of the amount paid returned, 0-100. */
  percent: number;
};

/** Sensible starting point for a new event: full refund a month out, half up to a fortnight. */
export const DEFAULT_REFUND_TIERS: RefundTier[] = [
  { daysBefore: 30, percent: 100 },
  { daysBefore: 14, percent: 50 },
];

/**
 * The one description of who does what, rendered identically everywhere it
 * appears. Kept here so the three surfaces cannot drift into contradicting each
 * other, which is exactly what happened before.
 */
export const REFUND_PROCESS_COPY =
  "Startline processes approved refunds back to your original payment method. " +
  "Allow 5 to 10 business days for it to appear.";

/** Tiers, most generous window first. Invalid entries are dropped. */
function normaliseTiers(tiers: RefundTier[]): RefundTier[] {
  return tiers
    .filter(
      (t) =>
        Number.isFinite(t.daysBefore) &&
        Number.isFinite(t.percent) &&
        t.daysBefore >= 0 &&
        t.percent >= 0 &&
        t.percent <= 100,
    )
    .sort((a, b) => b.daysBefore - a.daysBefore);
}

/**
 * Percentage owed for an entry cancelled `daysUntilEvent` out. The first tier
 * whose window the athlete still falls inside wins; no match means no refund.
 */
export function refundPercentFor(tiers: RefundTier[], daysUntilEvent: number): number {
  const match = normaliseTiers(tiers).find((t) => daysUntilEvent >= t.daysBefore);
  return match?.percent ?? 0;
}

/** Cents owed on an entry, rounded to the nearest cent. */
export function refundAmountCents(
  tiers: RefundTier[],
  paidCents: number,
  daysUntilEvent: number,
): number {
  const percent = refundPercentFor(tiers, daysUntilEvent);
  return Math.round((paidCents * percent) / 100);
}

/**
 * Whole days between today and the event. Both are plain ISO dates (yyyy-mm-dd),
 * compared in UTC so a late-evening request does not read as a day earlier.
 * Negative once the event has passed.
 */
export function daysUntil(eventDate: string, today: string): number {
  const MS_PER_DAY = 86_400_000;
  const from = Date.parse(`${today}T00:00:00Z`);
  const to = Date.parse(`${eventDate}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / MS_PER_DAY);
}

/**
 * Plain-English lines describing a policy, in the order an athlete reads them.
 * Returns one line per tier plus the closing "under N days" line, so callers can
 * render them as a list or join them into a sentence.
 */
export function describeTiers(tiers: RefundTier[]): string[] {
  const sorted = normaliseTiers(tiers);
  const lines: string[] = [];

  if (sorted.length === 0) {
    lines.push("No refunds at any time.");
  } else {
    sorted.forEach((tier, i) => {
      const next = sorted[i + 1];
      // A 0-day tier covers right up to the start, so "0+ days before" (and
      // "0 to 29 days before") reads like a typo. Say what it actually means.
      const window =
        tier.daysBefore === 0
          ? i === 0
            ? "Any time before the event"
            : `Under ${sorted[i - 1].daysBefore} days before`
          : i === 0
            ? `${tier.daysBefore}+ days before`
            : `${tier.daysBefore} to ${sorted[i - 1].daysBefore - 1} days before`;
      const amount =
        tier.percent === 100 ? "full refund" : tier.percent === 0 ? "no refund" : `${tier.percent}% back`;
      lines.push(`${window}: ${amount}.`);
      if (!next && tier.daysBefore > 0) {
        lines.push(`Under ${tier.daysBefore} days before: no refund.`);
      }
    });
  }

  return lines;
}

/**
 * The refund policies an organiser can choose from, each one complete on its own.
 *
 * The form used to offer these as independent toggles, which let an organiser
 * tick "No refunds" and "Full refund 30+ days out" together and publish a policy
 * that contradicted itself. They are mutually exclusive by construction now:
 * picking one replaces the tiers outright.
 */
export type RefundPreset = {
  id: string;
  /** Short name for the option card. */
  label: string;
  tiers: RefundTier[];
};

export const REFUND_PRESETS: RefundPreset[] = [
  { id: "tiered",       label: "Tiered refund",          tiers: DEFAULT_REFUND_TIERS },
  { id: "full-30",      label: "Full refund to 30 days", tiers: [{ daysBefore: 30, percent: 100 }] },
  { id: "full-anytime", label: "Always refundable",      tiers: [{ daysBefore: 0, percent: 100 }] },
  { id: "none",         label: "No refunds",             tiers: [] },
];

const tierKey = (tiers: RefundTier[]) =>
  normaliseTiers(tiers)
    .map((t) => `${t.daysBefore}:${t.percent}`)
    .join(",");

/**
 * The preset a tier list corresponds to, or null when it does not match one.
 *
 * Events created before the presets existed (and the seed data) carry bespoke
 * tiers like 21/7 days. Those must keep working, so callers show them as a
 * custom policy rather than silently snapping them to the nearest preset.
 */
export function matchRefundPreset(tiers: RefundTier[]): RefundPreset | null {
  const key = tierKey(tiers);
  return REFUND_PRESETS.find((p) => tierKey(p.tiers) === key) ?? null;
}

/**
 * A policy is valid when no two rules cover the same day and every percentage is
 * in range. An empty list is valid: it means "no refunds at any time", which is a
 * deliberate choice rather than an unfinished form.
 */
export function tiersAreValid(tiers: RefundTier[]): boolean {
  const days = tiers.map((t) => t.daysBefore);
  if (new Set(days).size !== days.length) return false;
  return tiers.every(
    (t) =>
      Number.isInteger(t.daysBefore) &&
      t.daysBefore >= 0 &&
      Number.isInteger(t.percent) &&
      t.percent >= 0 &&
      t.percent <= 100,
  );
}

/** Reads unknown JSON off the Event row back into tiers, tolerating bad data. */
export function parseTiers(value: unknown): RefundTier[] {
  if (!Array.isArray(value)) return [];
  return normaliseTiers(
    value.flatMap((raw) => {
      if (typeof raw !== "object" || raw === null) return [];
      const { daysBefore, percent } = raw as Record<string, unknown>;
      if (typeof daysBefore !== "number" || typeof percent !== "number") return [];
      return [{ daysBefore, percent }];
    }),
  );
}

/**
 * Maps a legacy free-text `refundPolicy` onto tiers, for the one-off backfill.
 *
 * Before this module a policy was the four preset labels concatenated with ". ",
 * so the presets are matched by phrase. Returns null when nothing matches, which
 * means the text was custom and should stay as notes.
 *
 * "Deferrals accepted" was one of those old labels but is deliberately not
 * matched here: deferrals are no longer a thing the platform models, so the
 * phrase is left in the notes rather than being stripped out and lost.
 */
export function parseLegacyPolicy(
  text: string,
): { tiers: RefundTier[]; notes: string } | null {
  const presets: { phrase: string; tier?: RefundTier }[] = [
    { phrase: "No refunds" },
    { phrase: "Full refund 30+ days out", tier: { daysBefore: 30, percent: 100 } },
    { phrase: "50% refund 14–30 days", tier: { daysBefore: 14, percent: 50 } },
    { phrase: "50% refund 14-30 days", tier: { daysBefore: 14, percent: 50 } },
  ];

  let notes = text;
  let matched = false;
  const tiers: RefundTier[] = [];

  for (const preset of presets) {
    if (!notes.includes(preset.phrase)) continue;
    matched = true;
    notes = notes.replace(preset.phrase, "");
    if (preset.tier) tiers.push(preset.tier);
  }

  if (!matched) return null;

  return {
    tiers: normaliseTiers(tiers),
    notes: notes.replace(/^[.,\s]+|[.,\s]+$/g, "").replace(/\s*\.\s*\./g, ".").trim(),
  };
}
