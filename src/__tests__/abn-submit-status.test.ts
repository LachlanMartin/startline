import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  organiserFindUnique: vi.fn(),
  eventCreate: vi.fn(),
}));

vi.mock("@/lib/organiser-api-auth", () => ({
  requireOrganiser: async () => ({ error: null, session: await mocks.session() }),
}));
vi.mock("@/lib/amplify-server", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    organiser: { findUnique: mocks.organiserFindUnique },
    event:     { create: mocks.eventCreate },
  },
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => null }));
vi.mock("@/lib/archive-events", () => ({ archivePastEvents: async () => {} }));
vi.mock("@/lib/slugs", () => ({
  withUniqueSlug: async (_t: string, write: (s: string) => unknown) => write("slug"),
}));
vi.mock("@/lib/notify-organiser-followers", () => ({
  notifyOrganiserFollowers: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/organiser/events/route";

const ABN = "51824753556";

// A payload complete enough to pass the submit-time required-field check.
const payload = (over: Record<string, unknown> = {}) => ({
  title: "Trail Half", discipline: "running", eventDate: "2026-11-01",
  startTime: "07:00", city: "Melbourne", state: "VIC",
  format: "Road", level: "All levels",
  registrationType: "startline", submit: true,
  ...over,
});

const post = (body: Record<string, unknown>) =>
  POST(new NextRequest("http://localhost/api/organiser/events", {
    method: "POST",
    body: JSON.stringify(body),
  }));

const statusOf = () => mocks.eventCreate.mock.calls[0][0].data.status;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.session.mockResolvedValue({ sub: "org-1", verified: true, role: "OWNER" });
  mocks.organiserFindUnique.mockResolvedValue({ abn: ABN });
  mocks.eventCreate.mockImplementation(async (args: { data: { status: string } }) => ({
    id: "e1", status: args.data.status, title: "Trail Half",
  }));
});

describe("POST /api/organiser/events — submitting without an ABN", () => {
  // The whole point of the change: the organiser reaches the end of the wizard
  // and their work is saved, instead of being refused after five steps.
  it("saves the event instead of rejecting the submission", async () => {
    mocks.organiserFindUnique.mockResolvedValue({ abn: null });

    const res = await post(payload());

    expect(res.status).toBe(200);
    expect(mocks.eventCreate).toHaveBeenCalled();
  });

  it("tells the organiser why, once the event is safely saved", async () => {
    mocks.organiserFindUnique.mockResolvedValue({ abn: null });

    const body = await (await post(payload())).json();

    expect(body.abnRequired).toBe(true);
    expect(body.notice).toContain("ABN");
  });

  // Without this a verified organiser would publish a paid listing with no ABN
  // and no admin would ever see it, which is the outcome the rule prevents.
  it("withholds auto-approval from a verified organiser", async () => {
    mocks.organiserFindUnique.mockResolvedValue({ abn: null });

    await post(payload());

    expect(statusOf()).toBe("PENDING");
  });

  it("auto-approves a verified organiser that has one", async () => {
    await post(payload());

    expect(statusOf()).toBe("APPROVED");
    expect((await (await post(payload())).json()).abnRequired).toBeUndefined();
  });

  it("still sends an unverified organiser to review", async () => {
    mocks.session.mockResolvedValue({ sub: "org-1", verified: false, role: "OWNER" });

    await post(payload());

    expect(statusOf()).toBe("PENDING");
  });

  // External registration takes no money through Startline, so no ABN is needed
  // and the organiser's verified status alone decides.
  it("ignores a missing ABN for externally-registered events", async () => {
    mocks.organiserFindUnique.mockResolvedValue({ abn: null });

    const res = await post(payload({
      registrationType: "external",
      registrationUrl: "https://example.com/enter",
    }));

    expect(statusOf()).toBe("APPROVED");
    expect((await res.json()).abnRequired).toBeUndefined();
    // The route looks the organiser up again to notify followers, so assert on
    // the ABN read specifically rather than on the mock being untouched.
    expect(mocks.organiserFindUnique).not.toHaveBeenCalledWith(
      expect.objectContaining({ select: { abn: true } }),
    );
  });

  it("leaves a draft as a draft and never nags about it", async () => {
    mocks.organiserFindUnique.mockResolvedValue({ abn: null });

    const res = await post(payload({ submit: false }));

    expect(statusOf()).toBe("DRAFT");
    expect((await res.json()).abnRequired).toBeUndefined();
  });
});
