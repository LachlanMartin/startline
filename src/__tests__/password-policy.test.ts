import { describe, expect, it } from "vitest";
import { PASSWORD_RULES, checkPassword, isPasswordValid } from "@/lib/password-policy";

describe("password policy", () => {
  it("mirrors the Cognito user pool policy: 8 chars, upper, lower, number", () => {
    expect(PASSWORD_RULES.map((r) => r.id)).toEqual(["length", "uppercase", "lowercase", "number"]);
  });

  it("accepts a password meeting every rule", () => {
    expect(isPasswordValid("Parkrun24")).toBe(true);
    expect(checkPassword("Parkrun24").valid).toBe(true);
    expect(checkPassword("Parkrun24").firstFailure).toBeNull();
  });

  it("does not require a symbol, matching require_symbols = false", () => {
    expect(isPasswordValid("Abcdefg1")).toBe(true);
  });

  it.each([
    ["too short", "Ab1cdef", "length"],
    ["no uppercase", "parkrun24", "uppercase"],
    ["no lowercase", "PARKRUN24", "lowercase"],
    ["no number", "ParkrunAus", "number"],
  ])("rejects a password that is %s", (_label, password, failingRuleId) => {
    expect(isPasswordValid(password)).toBe(false);
    const { results, firstFailure } = checkPassword(password);
    expect(results.find((r) => r.id === failingRuleId)?.met).toBe(false);
    expect(firstFailure).not.toBeNull();
  });

  it("reports every rule at once rather than one failure at a time", () => {
    // This is the behaviour issue #286 asked for: an empty field already knows
    // all four rules, so the user never discovers them one submit at a time.
    const { results } = checkPassword("");
    expect(results).toHaveLength(4);
    expect(results.every((r) => !r.met)).toBe(true);
    expect(results.every((r) => r.label.length > 0)).toBe(true);
  });

  it("ticks rules off independently as the password improves", () => {
    const met = (p: string) => checkPassword(p).results.filter((r) => r.met).map((r) => r.id);
    expect(met("a")).toEqual(["lowercase"]);
    expect(met("aB")).toEqual(["uppercase", "lowercase"]);
    expect(met("aB1")).toEqual(["uppercase", "lowercase", "number"]);
    expect(met("aB1defgh")).toEqual(["length", "uppercase", "lowercase", "number"]);
  });
});
