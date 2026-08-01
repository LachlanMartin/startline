/** Shift an ISO yyyy-mm-dd date by `days`. Returns null if input is empty/invalid. */
export function shiftIsoDate(dateStr: string | null | undefined, days: number): string | null {
  if (!dateStr?.trim()) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
