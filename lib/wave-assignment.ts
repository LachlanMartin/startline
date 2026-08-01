/**
 * Organiser-defined start waves (heats).
 *
 * Each wave has a start time, an optional capacity, and optional match conditions
 * (finish-time band / gender / age band). Athletes are placed into the first wave
 * (in list order) whose conditions they satisfy and which still has room. Waves are
 * their own concept — nothing to do with the ticket tier an athlete bought.
 */

export interface WaveDef {
  id: string;
  label: string;
  startTime?: string;
  /** Max athletes; null/undefined means unlimited. */
  capacity?: number | null;
  // Conditions — an athlete must satisfy every condition that is set.
  finishMin?: number | null; // whole minutes, inclusive lower bound
  finishMax?: number | null; // whole minutes, inclusive upper bound
  genders?: string[];        // empty/undefined = any gender
  ageMin?: number | null;    // inclusive
  ageMax?: number | null;    // inclusive
}

export interface WaveSortCandidate {
  id: string;
  name: string;
  estimatedFinishMinutes: number | null;
  age: number | null;
  gender: string | null;
}

export interface WaveAssignment {
  registrationId: string;
  waveLabel: string;
}

export interface AssignResult {
  assignments: WaveAssignment[];
  unassignedIds: string[];
  perWave: Record<string, number>;
}

/** True when the athlete satisfies every condition set on the wave. */
export function matchesWave(c: WaveSortCandidate, w: WaveDef): boolean {
  if (w.finishMin != null || w.finishMax != null) {
    if (c.estimatedFinishMinutes == null) return false;
    if (w.finishMin != null && c.estimatedFinishMinutes < w.finishMin) return false;
    if (w.finishMax != null && c.estimatedFinishMinutes > w.finishMax) return false;
  }
  if (w.genders && w.genders.length > 0) {
    if (!c.gender || !w.genders.includes(c.gender)) return false;
  }
  if (w.ageMin != null || w.ageMax != null) {
    if (c.age == null) return false;
    if (w.ageMin != null && c.age < w.ageMin) return false;
    if (w.ageMax != null && c.age > w.ageMax) return false;
  }
  return true;
}

/**
 * Short organiser-facing reason an athlete sat outside every wave after auto-sort.
 * Capacity overflow is reported when they would match a wave but none had room.
 */
export function unassignedReason(c: WaveSortCandidate, waves: WaveDef[]): string {
  if (waves.length === 0) return "No waves set up yet";

  if (waves.some((w) => matchesWave(c, w))) {
    return "Matched a wave that was already full";
  }

  const reasons: string[] = [];
  const needsFinish = waves.some((w) => w.finishMin != null || w.finishMax != null);
  const needsAge = waves.some((w) => w.ageMin != null || w.ageMax != null);
  const genderWaves = waves.filter((w) => (w.genders?.length ?? 0) > 0);

  if (needsFinish) {
    if (c.estimatedFinishMinutes == null) {
      reasons.push("no finish estimate");
    } else {
      const inAnyBand = waves.some((w) => {
        if (w.finishMin == null && w.finishMax == null) return true;
        if (w.finishMin != null && c.estimatedFinishMinutes! < w.finishMin) return false;
        if (w.finishMax != null && c.estimatedFinishMinutes! > w.finishMax) return false;
        return true;
      });
      if (!inAnyBand) reasons.push("finish time outside wave bands");
    }
  }

  if (genderWaves.length === waves.length) {
    if (!c.gender) reasons.push("no gender on registration");
    else if (!genderWaves.some((w) => w.genders!.includes(c.gender!))) {
      reasons.push("gender not allowed in any wave");
    }
  }

  if (needsAge) {
    if (c.age == null) reasons.push("no date of birth");
    else {
      const inAnyAge = waves.some((w) => {
        if (w.ageMin == null && w.ageMax == null) return true;
        if (w.ageMin != null && c.age! < w.ageMin) return false;
        if (w.ageMax != null && c.age! > w.ageMax) return false;
        return true;
      });
      if (!inAnyAge) reasons.push("age outside wave bands");
    }
  }

  return reasons.length > 0 ? reasons.join(" · ") : "Doesn't match wave rules";
}

function orderWithinWave(a: WaveSortCandidate, b: WaveSortCandidate): number {
  const af = a.estimatedFinishMinutes;
  const bf = b.estimatedFinishMinutes;
  if (af != null && bf != null && af !== bf) return af - bf;
  if (af == null && bf != null) return 1;
  if (af != null && bf == null) return -1;
  return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
}

/**
 * Fill each wave, in list order, with the athletes that match its conditions,
 * up to its capacity. Within a wave athletes are ordered by finish estimate
 * (fastest first). Athletes who match no wave with room are left unassigned.
 */
export function assignAthletesToWaves(input: {
  candidates: WaveSortCandidate[];
  waves: WaveDef[];
}): AssignResult {
  const { candidates, waves } = input;
  const pool = new Map(candidates.map((c) => [c.id, c]));
  const assignments: WaveAssignment[] = [];
  const perWave: Record<string, number> = {};

  for (const wave of waves) {
    perWave[wave.label] = 0;
    const cap = wave.capacity != null && wave.capacity >= 0 ? wave.capacity : Infinity;
    if (cap === 0) continue;

    const matching = [...pool.values()].filter((c) => matchesWave(c, wave));
    matching.sort(orderWithinWave);

    for (const c of matching) {
      if (perWave[wave.label] >= cap) break;
      assignments.push({ registrationId: c.id, waveLabel: wave.label });
      perWave[wave.label] += 1;
      pool.delete(c.id);
    }
  }

  return { assignments, unassignedIds: [...pool.keys()], perWave };
}
