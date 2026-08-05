// Pure rules for organiser membership management (issue #109).
// Kept free of Prisma so they're unit-testable.

export const MAX_ORGS_PER_USER = 5;

export type MemberRole = "OWNER" | "MANAGER";

// Removing a member is allowed unless they are the last OWNER.
export function canRemoveMember(targetRole: MemberRole, ownerCount: number): {
  allowed: boolean;
  reason?: string;
} {
  if (targetRole === "OWNER" && ownerCount <= 1) {
    return { allowed: false, reason: "An organiser must always have at least one Owner." };
  }
  return { allowed: true };
}

// Ownership transfer promotes a MANAGER to OWNER and demotes the caller.
export function canTransferOwnership(targetRole: MemberRole): {
  allowed: boolean;
  reason?: string;
} {
  if (targetRole === "OWNER") {
    return { allowed: false, reason: "That user already owns the organiser." };
  }
  return { allowed: true };
}

// A user can be added unless they're already a member or past the org cap.
export function canAddMember(existingMembership: boolean, orgCount: number): {
  allowed: boolean;
  reason?: string;
} {
  if (existingMembership) {
    return { allowed: false, reason: "That user is already a member." };
  }
  if (orgCount >= MAX_ORGS_PER_USER) {
    return {
      allowed: false,
      reason: `Users can manage at most ${MAX_ORGS_PER_USER} organisations.`,
    };
  }
  return { allowed: true };
}
