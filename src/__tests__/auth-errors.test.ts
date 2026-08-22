import { describe, it, expect } from "vitest";
import { mapResetPasswordError } from "@/lib/auth-errors";

describe("mapResetPasswordError", () => {
  it("maps a code mismatch", () => {
    expect(mapResetPasswordError("CodeMismatchException: Invalid code")).toContain("code is incorrect");
  });

  it("maps an expired code", () => {
    expect(mapResetPasswordError("ExpiredCodeException: Code expired")).toContain("expired");
  });

  it("distinguishes password reuse from complexity", () => {
    const reuse = "InvalidPasswordException: Password cannot be the same as a previous password";
    expect(mapResetPasswordError(reuse)).toContain("different from your current password");
  });

  it("maps a generic InvalidPasswordException to complexity", () => {
    const complexity = "InvalidPasswordException: Password does not meet requirements";
    expect(mapResetPasswordError(complexity)).toContain("at least 8 characters");
  });

  it("falls back to a generic message", () => {
    expect(mapResetPasswordError("Some other error")).toContain("Could not reset");
  });
});
