import { describe, it, expect } from "vitest";
import { matchesMagicBytes } from "@/lib/upload-magic-bytes";

function buf(hex: string): Buffer {
  return Buffer.from(hex.replace(/ /g, ""), "hex");
}

describe("matchesMagicBytes", () => {
  const valid = [
    ["image/jpeg", "ff d8 ff e0 00 10 4a 46 49 46"],
    ["image/png", "89 50 4e 47 0d 0a 1a 0a 00 00"],
    ["image/webp", "52 49 46 46 24 00 00 00 57 45 42 50"],
    ["image/gif", "47 49 46 38 39 61"],
    ["application/pdf", "25 50 44 46 2d 31 2e 34"],
    ["video/mp4", "00 00 00 18 66 74 79 70 69 73 6f 6d"],
    ["video/webm", "1a 45 df a3 93 42 82 88"],
    ["video/quicktime", "00 00 00 14 66 74 79 70 71 74 20 20"],
    ["video/avi", "52 49 46 46 24 06 00 00 41 56 49 20"],
    ["video/ogg", "4f 67 67 53 00 02 00 00"],
  ] as const;

  it.each(valid)("accepts a genuine %s", (mime, hex) => {
    expect(matchesMagicBytes(buf(hex), mime)).toBe(true);
  });

  it("rejects an HTML payload declared as an image", () => {
    const html = Buffer.from("<!DOCTYPE html><html><body>hello</body></html>");
    expect(matchesMagicBytes(html, "image/png")).toBe(false);
    expect(matchesMagicBytes(html, "image/jpeg")).toBe(false);
  });

  it("rejects a PNG payload declared as a PDF", () => {
    expect(matchesMagicBytes(buf("89 50 4e 47 0d 0a 1a 0a"), "application/pdf")).toBe(false);
  });

  it("returns true for unknown types (unreachable via the allowlist)", () => {
    expect(matchesMagicBytes(Buffer.from("anything"), "text/html")).toBe(true);
  });
});
