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
