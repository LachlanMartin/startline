import { describe, it, expect } from "vitest";
import {
  averageOverallRating,
  displayNameFromUser,
  toOrganiserRating,
  topRatedEventsFromReviews,
} from "@/lib/review-helpers";

describe("averageOverallRating", () => {
  it("returns null for an empty list", () => {
    expect(averageOverallRating([])).toBeNull();
  });

  it("returns the rating for a single review", () => {
    expect(averageOverallRating([{ overallRating: 5 }])).toBe(5);
    expect(averageOverallRating([4])).toBe(4);
  });

  it("rounds to one decimal place", () => {
    expect(averageOverallRating([5, 4, 5])).toBe(4.7);
    expect(averageOverallRating([{ overallRating: 4 }, { overallRating: 5 }])).toBe(4.5);
  });
});

describe("toOrganiserRating", () => {
  it("returns null when count is 0", () => {
    expect(toOrganiserRating(4.5, 0)).toBeNull();
  });

  it("returns null when average is missing", () => {
    expect(toOrganiserRating(null, 3)).toBeNull();
  });

  it("rounds average and keeps count", () => {
    expect(toOrganiserRating(4.666, 7)).toEqual({ average: 4.7, count: 7 });
  });
});

describe("topRatedEventsFromReviews", () => {
  it("returns empty when no event-linked reviews", () => {
    expect(topRatedEventsFromReviews([{ overallRating: 5 }])).toEqual([]);
  });

  it("ranks by average then count and caps at limit", () => {
    const result = topRatedEventsFromReviews(
      [
        { eventId: "a", eventTitle: "Alpha", overallRating: 5 },
        { eventId: "a", eventTitle: "Alpha", overallRating: 5 },
        { eventId: "b", eventTitle: "Beta", overallRating: 4 },
        { eventId: "c", eventTitle: "Gamma", overallRating: 5 },
        { eventId: "d", eventTitle: "Delta", overallRating: 3 },
      ],
      3
    );
    expect(result.map((e) => e.eventId)).toEqual(["a", "c", "b"]);
    expect(result[0]).toMatchObject({ average: 5, count: 2 });
  });
});

describe("displayNameFromUser", () => {
  it("prefers name, then username, then email local-part", () => {
    expect(displayNameFromUser({ name: "Alex", username: "alex", email: "a@x.com" })).toBe("Alex");
    expect(displayNameFromUser({ name: null, username: "alex", email: "a@x.com" })).toBe("alex");
    expect(displayNameFromUser({ name: null, username: null, email: "runner@x.com" })).toBe("runner");
  });
});
