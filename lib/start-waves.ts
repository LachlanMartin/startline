import prisma from "@/lib/prisma";
import { CAPACITY_COUNTING_STATUSES } from "@/lib/registration-status";
import type { WaveDef } from "@/lib/wave-assignment";

export interface StartWaveWithCount extends WaveDef {
  sortOrder: number;
  /** Athletes currently in this wave whose status counts against capacity. */
  assigned: number;
}

/**
 * Validate and normalise a raw start-wave array from the client into WaveDef[].
 * Returns an error object (not thrown) on the first problem so callers can 400.
 */
export function sanitizeWaveInput(input: unknown): WaveDef[] | { error: string } {
  if (!Array.isArray(input)) return { error: "startWaves must be an array." };
  const seen = new Set<string>();
  const out: WaveDef[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return { error: "Each wave must be an object." };
    const w = raw as Record<string, unknown>;
    const label = String(w.label ?? "").trim();
    if (!label) return { error: "Every wave needs a name." };
    const key = label.toLowerCase();
    if (seen.has(key)) return { error: `Duplicate wave name "${label}".` };
    seen.add(key);

    const num = (v: unknown): number | null => {
      if (v === "" || v == null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? Math.round(n) : null;
    };
    const genders = Array.isArray(w.genders) ? w.genders.map((g) => String(g)).filter(Boolean) : [];

    out.push({
      id: String(w.id ?? label).trim() || label,
      label,
      startTime: String(w.startTime ?? "").trim() || undefined,
      capacity: num(w.capacity),
      finishMin: num(w.finishMin),
      finishMax: num(w.finishMax),
      genders,
      ageMin: num(w.ageMin),
      ageMax: num(w.ageMax),
    });
  }
  return out;
}

/** The event's start waves, ordered, each with a server-computed assigned count. */
export async function wavesWithCounts(eventId: string): Promise<StartWaveWithCount[]> {
  const [waves, counts] = await Promise.all([
    prisma.startWave.findMany({ where: { eventId }, orderBy: { sortOrder: "asc" } }),
    prisma.registration.groupBy({
      by: ["startWaveId"],
      where: { eventId, status: { in: CAPACITY_COUNTING_STATUSES } },
      _count: { _all: true },
    }),
  ]);
  const byId = new Map(counts.map((c) => [c.startWaveId, c._count._all]));
  return waves.map((w) => ({
    id: w.id,
    label: w.label,
    startTime: w.startTime ?? undefined,
    capacity: w.capacity,
    finishMin: w.finishMin,
    finishMax: w.finishMax,
    genders: w.genders,
    ageMin: w.ageMin,
    ageMax: w.ageMax,
    sortOrder: w.sortOrder,
    assigned: byId.get(w.id) ?? 0,
  }));
}
