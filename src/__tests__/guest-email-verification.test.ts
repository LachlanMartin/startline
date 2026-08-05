import { describe, it, expect } from "vitest";
import { generateVerificationCode, hashVerificationCode } from "@/lib/guest-email-verification";
import { normalizeGuestEmail, getEmailsRequiringVerification } from "@/lib/registration-form";

describe("guest email verification helpers", () => {
  it("normalizes email addresses", () => {
    expect(normalizeGuestEmail("  Alex@Example.COM ")).toBe("alex@example.com");
  });

  it("generates a 6-digit code", () => {
    const code = generateVerificationCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("hashes codes consistently", () => {
    const hash = hashVerificationCode("123456", "alex@example.com", "event-1");
    expect(hash).toBe(hashVerificationCode("123456", "alex@example.com", "event-1"));
    expect(hash).not.toBe(hashVerificationCode("654321", "alex@example.com", "event-1"));
  });

  it("requires all guest participant emails", () => {
    expect(getEmailsRequiringVerification(["a@example.com", "b@example.com"], null)).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
  });

  it("skips the signed-in account email", () => {
    expect(getEmailsRequiringVerification(
      ["jade.nguyen@startline.test", "friend@example.com"],
      "jade.nguyen@startline.test"
    )).toEqual(["friend@example.com"]);
  });
});
