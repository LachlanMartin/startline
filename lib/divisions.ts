/**
 * Display helpers for the divisions organisers enter against an event
 * ("5K", "Half Marathon", "160K Gran Fondo").
 *
 * These are presentation only. The stored value stays exactly as the organiser
 * typed it, because that is what the listing filters on.
 */

/**
 * Spell distances out as kilometres: "10K" reads as "10km", "2.4K Swim" as
 * "2.4km Swim".
 *
 * Only a number followed by a standalone K is rewritten, so metre distances
 * ("400m Junior") and word divisions ("Half Marathon", "Elite Men") are left
 * alone.
 */
export function formatDivisionLabel(division: string): string {
  return division.replace(/\b(\d+(?:\.\d+)?)\s*K\b/gi, "$1km");
}

/** The text shown in the search field once a category or division is picked. */
export function selectionLabel(disciplineLabel: string, division?: string | null): string {
  return division ? `${disciplineLabel} - ${formatDivisionLabel(division)}` : disciplineLabel;
}
