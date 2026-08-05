/**
 * Pure sequential bib assignment for a start list.
 * Assigns integer strings starting at `start`, skipping athletes who already
 * have a bib when `onlyWithoutBib` is true. Existing bibs in `taken` are never reused.
 */

export interface BibCandidate {
  id: string;
  name: string;
  waveLabel: string | null;
  bibNumber: string | null;
}

export interface AssignBibsInput {
  candidates: BibCandidate[];
  start: number;
  /** When set, only athletes in this wave are considered. */
  waveFilter?: string | null;
  onlyWithoutBib?: boolean;
  /** Bibs already taken on this event (including athletes not in candidates). */
  taken?: Set<string>;
}

export interface BibAssignment {
  registrationId: string;
  bibNumber: string;
}

/** Lowest free integer bib at or above `start`, optionally ignoring one current holder. */
export function nextAvailableBib(input: {
  taken: Iterable<string>;
  start?: number;
  /** Bib currently held by the athlete being edited — treated as free for them. */
  ignore?: string | null;
}): string {
  const start = input.start ?? 1;
  if (!Number.isInteger(start) || start < 1) {
    throw new Error("Start number must be a positive integer.");
  }
  const occupied = new Set(
    [...input.taken].map((b) => b.trim()).filter(Boolean)
  );
  const ignore = input.ignore?.trim();
  if (ignore) occupied.delete(ignore);

  let next = start;
  while (occupied.has(String(next))) next += 1;
  return String(next);
}

export function assignSequentialBibs(input: AssignBibsInput): BibAssignment[] {
  const {
    candidates,
    start,
    waveFilter = null,
    onlyWithoutBib = true,
    taken = new Set(),
  } = input;

  if (!Number.isInteger(start) || start < 1) {
    throw new Error("Start number must be a positive integer.");
  }

  const occupied = new Set(
    [...taken].map((b) => b.trim()).filter(Boolean)
  );
  for (const c of candidates) {
    if (c.bibNumber?.trim()) occupied.add(c.bibNumber.trim());
  }

  let pool = [...candidates];
  if (waveFilter) {
    pool = pool.filter((c) => c.waveLabel === waveFilter);
  }
  if (onlyWithoutBib) {
    pool = pool.filter((c) => !c.bibNumber?.trim());
  }

  pool.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

  const assignments: BibAssignment[] = [];
  let next = start;
  for (const athlete of pool) {
    while (occupied.has(String(next))) next += 1;
    const bib = String(next);
    occupied.add(bib);
    assignments.push({ registrationId: athlete.id, bibNumber: bib });
    next += 1;
  }

  return assignments;
}
