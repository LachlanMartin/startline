import { describe, it, expect } from "vitest";
import { eventPayloadSchema } from "@/lib/schemas";

describe("eventPayloadSchema time/date ordering", () => {
  it("rejects an end time at or before the start time", () => {
    const res = eventPayloadSchema.safeParse({ startTime: "09:00", endTime: "09:00" });
    expect(res.success).toBe(false);
    expect(res.success ? "" : res.error.issues[0].message).toBe("End time must be after start time.");
  });

  it("accepts an end time after the start time", () => {
    const res = eventPayloadSchema.safeParse({ startTime: "09:00", endTime: "12:00" });
    expect(res.success).toBe(true);
  });

  it("rejects an end date before the start date", () => {
    const res = eventPayloadSchema.safeParse({ eventDate: "2026-10-02", endDate: "2026-10-01" });
    expect(res.success).toBe(false);
    expect(res.success ? "" : res.error.issues[0].message).toBe("End date must be on or after the start date.");
  });

  it("rejects a ticket category closing after the event ends", () => {
    const res = eventPayloadSchema.safeParse({
      eventDate: "2026-10-02",
      waves: [{ label: "General", price: "50", closes: "2026-10-03" }],
    });
    expect(res.success).toBe(false);
    expect(res.success ? "" : res.error.issues[0].message).toBe("A ticket category cannot close after the event ends.");
  });

  it("allows a ticket category closing on or before the event end", () => {
    const res = eventPayloadSchema.safeParse({
      eventDate: "2026-10-02",
      waves: [{ label: "General", price: "50", closes: "2026-10-02" }],
    });
    expect(res.success).toBe(true);
  });

  it("does not block partial drafts missing one side of a comparison", () => {
    const res = eventPayloadSchema.safeParse({ startTime: "09:00" });
    expect(res.success).toBe(true);
  });
});