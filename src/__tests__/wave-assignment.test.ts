import { describe, it, expect } from "vitest";
import { assignAthletesToWaves, matchesWave, unassignedReason, type WaveSortCandidate, type WaveDef } from "@/lib/wave-assignment";
import { parseFinishToMinutes, formatFinishMinutes } from "@/lib/registration-form";

const c = (
  id: string,
  name: string,
  extra: Partial<WaveSortCandidate> = {},
): WaveSortCandidate => ({
  id,
  name,
  estimatedFinishMinutes: null,
  age: null,
  gender: null,
  ...extra,
});

const wave = (id: string, extra: Partial<WaveDef> = {}): WaveDef => ({ id, label: id, ...extra });

describe("matchesWave", () => {
  it("matches a finish-time band (inclusive)", () => {
    const w = wave("W", { finishMin: 40, finishMax: 60 });
    expect(matchesWave(c("a", "A", { estimatedFinishMinutes: 50 }), w)).toBe(true);
    expect(matchesWave(c("a", "A", { estimatedFinishMinutes: 40 }), w)).toBe(true);
    expect(matchesWave(c("a", "A", { estimatedFinishMinutes: 61 }), w)).toBe(false);
    // no estimate cannot satisfy a finish condition
    expect(matchesWave(c("a", "A"), w)).toBe(false);
  });

  it("matches gender and age conditions", () => {
    const w = wave("W", { genders: ["Female"], ageMin: 40 });
    expect(matchesWave(c("a", "A", { gender: "Female", age: 42 }), w)).toBe(true);
    expect(matchesWave(c("a", "A", { gender: "Male", age: 42 }), w)).toBe(false);
    expect(matchesWave(c("a", "A", { gender: "Female", age: 30 }), w)).toBe(false);
  });

  it("a wave with no conditions matches anyone", () => {
    expect(matchesWave(c("a", "A"), wave("W"))).toBe(true);
  });
});

describe("assignAthletesToWaves", () => {
  it("places athletes in the first matching wave with room", () => {
    const waves = [
      wave("Fast", { finishMax: 45 }),
      wave("Rest", {}), // catch-all
    ];
    const candidates = [
      c("x", "X", { estimatedFinishMinutes: 40 }),
      c("y", "Y", { estimatedFinishMinutes: 80 }),
    ];
    const { assignments, unassignedIds } = assignAthletesToWaves({ candidates, waves });
    expect(assignments).toEqual([
      { registrationId: "x", waveLabel: "Fast" },
      { registrationId: "y", waveLabel: "Rest" },
    ]);
    expect(unassignedIds).toEqual([]);
  });

  it("respects capacity and orders within a wave by pace", () => {
    const waves = [wave("A", { capacity: 2 }), wave("B", {})];
    const candidates = [
      c("slow", "Slow", { estimatedFinishMinutes: 90 }),
      c("fast", "Fast", { estimatedFinishMinutes: 30 }),
      c("mid", "Mid", { estimatedFinishMinutes: 60 }),
    ];
    const { assignments, perWave } = assignAthletesToWaves({ candidates, waves });
    // Wave A takes the two fastest; the third overflows to B.
    expect(assignments).toEqual([
      { registrationId: "fast", waveLabel: "A" },
      { registrationId: "mid", waveLabel: "A" },
      { registrationId: "slow", waveLabel: "B" },
    ]);
    expect(perWave).toEqual({ A: 2, B: 1 });
  });

  it("leaves athletes who match no wave unassigned", () => {
    const waves = [wave("Women", { genders: ["Female"] })];
    const candidates = [
      c("f", "F", { gender: "Female" }),
      c("m", "M", { gender: "Male" }),
    ];
    const { assignments, unassignedIds } = assignAthletesToWaves({ candidates, waves });
    expect(assignments).toEqual([{ registrationId: "f", waveLabel: "Women" }]);
    expect(unassignedIds).toEqual(["m"]);
  });
});

describe("unassignedReason", () => {
  it("calls out missing finish estimate", () => {
    const waves = [wave("A", { finishMax: 50 })];
    expect(unassignedReason(c("a", "A"), waves)).toMatch(/no finish estimate/i);
  });

  it("calls out gender mismatch when every wave filters gender", () => {
    const waves = [wave("W", { genders: ["Female"] })];
    expect(unassignedReason(c("m", "M", { gender: "Male" }), waves)).toMatch(/gender/i);
  });

  it("calls out capacity when the athlete would otherwise match", () => {
    const waves = [wave("A", { capacity: 0, genders: ["Male"] })];
    // capacity 0 still "matches" conditions; assign leaves them out — reason for full waves
    expect(unassignedReason(c("m", "M", { gender: "Male" }), waves)).toMatch(/already full/i);
  });
});

describe("parseFinishToMinutes / formatFinishMinutes", () => {
  it("parses h:mm and plain minutes", () => {
    expect(parseFinishToMinutes("3:30")).toBe(210);
    expect(parseFinishToMinutes("0:45")).toBe(45);
    expect(parseFinishToMinutes("45")).toBe(45);
    expect(parseFinishToMinutes("")).toBeNull();
    expect(parseFinishToMinutes("abc")).toBeNull();
  });

  it("round-trips through formatFinishMinutes", () => {
    expect(formatFinishMinutes(210)).toBe("3:30");
    expect(formatFinishMinutes(45)).toBe("0:45");
    expect(formatFinishMinutes(null)).toBe("");
  });
});
