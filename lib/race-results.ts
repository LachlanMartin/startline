/**
 * Pure validation for organiser-entered race results. No DB, no React — the
 * dialog, the CSV importer and the API route all share one definition of what
 * counts as a finish time, so a result can never reach an athlete's public
 * profile in a format nobody can read.
 */

/**
 * `m:ss`, `mm:ss`, `h:mm:ss` or `hh:mm:ss`, with optional `.s`–`.sss` fractional
 * seconds. Minutes and seconds must be 00-59; hours are free (ultras run long).
 */
const RACE_TIME = /^(?:(\d{1,3}):)?([0-5]?\d):([0-5]\d)(?:\.(\d{1,3}))?$/;

export function isValidRaceTime(input: string): boolean {
  return RACE_TIME.test(input.trim());
}

/**
 * Trim and zero-pad a finish time to a consistent shape, or null if unreadable.
 * `41:5` is a typo, not a time — it is rejected rather than guessed at.
 */
export function normaliseRaceTime(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const m = RACE_TIME.exec(raw);
  if (!m) return null;
  const [, hours, minutes, seconds, fraction] = m;
  const mm = hours ? minutes.padStart(2, "0") : minutes.replace(/^0(?=\d)/, "");
  const base = hours ? `${hours}:${mm}:${seconds}` : `${mm}:${seconds}`;
  return fraction ? `${base}.${fraction}` : base;
}

/** Total seconds for a valid race time, or null. Useful for sorting/ranking. */
export function raceTimeToSeconds(input: string): number | null {
  const m = RACE_TIME.exec(input.trim());
  if (!m) return null;
  const [, hours, minutes, seconds, fraction] = m;
  const whole =
    (hours ? parseInt(hours, 10) : 0) * 3600 +
    parseInt(minutes, 10) * 60 +
    parseInt(seconds, 10);
  return fraction ? whole + Number(`0.${fraction}`) : whole;
}
