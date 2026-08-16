import type { OrganiserRole } from "@prisma/client";

// Deterministically picks the active organiser from a user's memberships:
// cookie (explicit switch) -> OWNER -> first membership. Shared by
// getOrganiserSession() and the memberships endpoint so event create/list
// always resolve the same organiser, even when the cookie is stale or missing.
export function pickActiveMembership<T extends { organiserId: string; role: OrganiserRole }>(
  memberships: T[],
  activeId?: string | null,
): T | null {
  if (memberships.length === 0) return null;
  if (memberships.length === 1) return memberships[0];
  return (
    memberships.find((m) => m.organiserId === activeId) ??
    memberships.find((m) => m.role === "OWNER") ??
    memberships[0]
  );
}
