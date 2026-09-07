import prisma from "@/lib/prisma";

const MAX_SLUG_LENGTH = 80;

/** Human-readable URL slug derived from an event title. Mirrors the backfill in
 * `prisma/migrations/*_add_event_slug` — keep them in sync. */
export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, MAX_SLUG_LENGTH)
      .replace(/-+$/g, "") || "event"
  );
}

/** A unique slug for `title` — appends "-2", "-3", … when the base is taken.
 * `excludeId` skips the event being renamed so its current slug doesn't collide
 * with the one it's being reassigned. */
export async function uniqueSlug(title: string, excludeId?: string): Promise<string> {
  const base = slugify(title);
  const existing = await prisma.event.findMany({
    where: {
      OR: [{ slug: base }, { slug: { startsWith: `${base}-` } }],
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { slug: true },
  });
  const taken = new Set(existing.map((e) => e.slug!));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** True for the unique-constraint violation raised when two writes claim the
 *  same event slug. */
function isSlugConflict(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const { code, meta } = err as { code?: unknown; meta?: { target?: unknown } };
  if (code !== "P2002") return false;
  const target = meta?.target;
  // Postgres names the index; be permissive when the driver doesn't report one.
  if (target === undefined) return true;
  const fields = Array.isArray(target) ? target : [target];
  return fields.some((f) => typeof f === "string" && f.includes("slug"));
}

/** Runs `write` with a slug for `title`, retrying if a concurrent write claimed
 *  it first. `uniqueSlug` reads the taken slugs before writing, so two events
 *  created from the same title at the same moment resolve to the same string and
 *  one of them used to fail the whole request with a bare 500. The retry re-runs
 *  the lookup, which now sees the winner and picks the next free suffix. */
export async function withUniqueSlug<T>(
  title: string,
  write: (slug: string) => Promise<T>,
  { excludeId, attempts = 3 }: { excludeId?: string; attempts?: number } = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await write(await uniqueSlug(title, excludeId));
    } catch (err) {
      if (attempt >= attempts || !isSlugConflict(err)) throw err;
    }
  }
}
