import { describe, it, expect } from "vitest";
import { isValidRaceTime, normaliseRaceTime, raceTimeToSeconds } from "@/lib/race-results";

describe("isValidRaceTime", () => {
  it("accepts mm:ss", () => {
    expect(isValidRaceTime("41:05")).toBe(true);
    expect(isValidRaceTime("9:07")).toBe(true);
  });

  it("accepts h:mm:ss and hh:mm:ss", () => {
    expect(isValidRaceTime("1:08:22")).toBe(true);
    expect(isValidRaceTime("12:34:56")).toBe(true);
  });

  it("accepts fractional seconds", () => {
    expect(isValidRaceTime("41:05.3")).toBe(true);
    expect(isValidRaceTime("1:08:22.451")).toBe(true);
  });

  it("tolerates surrounding whitespace", () => {
    expect(isValidRaceTime("  41:05  ")).toBe(true);
  });

  it("rejects free text, the bug that let 'banana' onto a public profile", () => {
    expect(isValidRaceTime("banana")).toBe(false);
    expect(isValidRaceTime("about 40 mins")).toBe(false);
    expect(isValidRaceTime("")).toBe(false);
  });

  it("rejects out-of-range minutes and seconds", () => {
    expect(isValidRaceTime("41:60")).toBe(false);
    expect(isValidRaceTime("1:60:00")).toBe(false);
    expect(isValidRaceTime("99:99:99")).toBe(false);
  });

  it("rejects a bare number, which is ambiguous between minutes and seconds", () => {
    expect(isValidRaceTime("41")).toBe(false);
  });

  it("rejects a single-digit seconds field", () => {
    expect(isValidRaceTime("41:5")).toBe(false);
  });
});

describe("normaliseRaceTime", () => {
  it("returns null for blank and unreadable input", () => {
    expect(normaliseRaceTime("")).toBeNull();
    expect(normaliseRaceTime("   ")).toBeNull();
    expect(normaliseRaceTime("banana")).toBeNull();
  });

  it("trims but otherwise preserves a valid time", () => {
    expect(normaliseRaceTime("  41:05 ")).toBe("41:05");
    expect(normaliseRaceTime("1:08:22")).toBe("1:08:22");
  });

  it("keeps fractional seconds", () => {
    expect(normaliseRaceTime("41:05.25")).toBe("41:05.25");
  });

  it("zero-pads the minutes field when hours are present", () => {
    expect(normaliseRaceTime("2:9:07")).toBe("2:09:07");
  });
});

describe("raceTimeToSeconds", () => {
  it("converts mm:ss", () => {
    expect(raceTimeToSeconds("41:05")).toBe(2465);
  });

  it("converts h:mm:ss", () => {
    expect(raceTimeToSeconds("1:08:22")).toBe(4102);
  });

  it("includes fractional seconds", () => {
    expect(raceTimeToSeconds("0:10.5")).toBeCloseTo(10.5, 5);
  });

  it("returns null for an invalid time", () => {
    expect(raceTimeToSeconds("banana")).toBeNull();
  });

  it("orders results correctly, so a faster time sorts first", () => {
    const times = ["1:08:22", "41:05", "9:07"];
    const sorted = [...times].sort(
      (a, b) => (raceTimeToSeconds(a) ?? Infinity) - (raceTimeToSeconds(b) ?? Infinity),
    );
    expect(sorted).toEqual(["9:07", "41:05", "1:08:22"]);
  });
});
