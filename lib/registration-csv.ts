/** CSV helpers for organiser results import. Export lives in registration-export.ts. */

/** Simple comma-split — fields must not contain commas (times/emails don't). */
export function parseCsvTable(text: string): { header: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { header: [], rows: [] };
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1).map((line) => line.split(",").map((c) => c.trim()));
  return { header, rows };
}
