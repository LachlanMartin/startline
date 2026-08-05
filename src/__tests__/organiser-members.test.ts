import { describe, it, expect } from "vitest";
import {
  canRemoveMember,
  canTransferOwnership,
  canAddMember,
  MAX_ORGS_PER_USER,
} from "@/lib/organiser-members";

describe("organiser members", () => {
  describe("canRemoveMember", () => {
    it("allows removing a MANAGER", () => {
      expect(canRemoveMember("MANAGER", 1)).toEqual({ allowed: true });
    });

    it("allows removing an OWNER when another remains", () => {
      expect(canRemoveMember("OWNER", 2)).toEqual({ allowed: true });
    });

    it("blocks removing the last OWNER", () => {
      const result = canRemoveMember("OWNER", 1);
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/at least one Owner/);
    });
  });

  describe("canTransferOwnership", () => {
    it("allows promoting a MANAGER to owner", () => {
      expect(canTransferOwnership("MANAGER")).toEqual({ allowed: true });
    });

    it("blocks transferring to an existing OWNER", () => {
      const result = canTransferOwnership("OWNER");
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/already owns/);
    });
  });

  describe("canAddMember", () => {
    it("blocks an existing member", () => {
      const result = canAddMember(true, 1);
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/already a member/);
    });

    it("blocks past the org cap", () => {
      const result = canAddMember(false, MAX_ORGS_PER_USER);
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/at most/);
    });

    it("allows a new member under the cap", () => {
      expect(canAddMember(false, MAX_ORGS_PER_USER - 1)).toEqual({ allowed: true });
    });
  });
});
