import { describe, it, expect } from "vitest";
import { UPLOAD_LIMITS, uploadSizeError } from "@/lib/upload-limits";

const MB = 1024 * 1024;

describe("uploadSizeError", () => {
  it("accepts a file exactly at the cap", () => {
    expect(uploadSizeError("document", 15 * MB)).toBeNull();
    expect(uploadSizeError("cover", 10 * MB)).toBeNull();
    expect(uploadSizeError("video", 200 * MB)).toBeNull();
  });

  it("rejects a file one byte over the cap with the type's message", () => {
    expect(uploadSizeError("document", 15 * MB + 1)).toBe("PDF must be 15 MB or smaller.");
    expect(uploadSizeError("cover", 10 * MB + 1)).toBe("Image must be 10 MB or smaller.");
    expect(uploadSizeError("video", 200 * MB + 1)).toBe("Video must be 200 MB or smaller.");
  });

  it("caps every allowlisted upload type", () => {
    for (const type of Object.keys(UPLOAD_LIMITS)) {
      expect(uploadSizeError(type, 5 * 1024 * MB)).not.toBeNull();
    }
  });

  it("defers unknown types to the route's own allowlist", () => {
    expect(uploadSizeError("archive", 5 * 1024 * MB)).toBeNull();
  });

  it("keeps image caps consistent across image types", () => {
    expect(UPLOAD_LIMITS.logo.bytes).toBe(UPLOAD_LIMITS.cover.bytes);
    expect(UPLOAD_LIMITS.photo.bytes).toBe(UPLOAD_LIMITS.cover.bytes);
    expect(UPLOAD_LIMITS.avatar.bytes).toBe(UPLOAD_LIMITS.cover.bytes);
  });
});
