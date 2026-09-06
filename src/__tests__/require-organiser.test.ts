import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  resolveOrganiserSession: vi.fn(),
}));

vi.mock("@/lib/amplify-server", () => ({
  getServerSession: mocks.getServerSession,
  resolveOrganiserSession: mocks.resolveOrganiserSession,
}));

import { requireOrganiser } from "@/lib/organiser-api-auth";

const COGNITO = { sub: "cog_1", email: "sarah@startline.test", groups: [] };
const ORGANISER = {
  sub: "org_1",
  email: "sarah@startline.test",
  status: "APPROVED",
  verified: true,
  role: "OWNER" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("requireOrganiser", () => {
  it("hands back the session when the caller manages an organiser", async () => {
    mocks.getServerSession.mockResolvedValue(COGNITO);
    mocks.resolveOrganiserSession.mockResolvedValue(ORGANISER);

    const auth = await requireOrganiser();

    expect(auth.error).toBeNull();
    expect(auth.session).toEqual(ORGANISER);
  });

  it("answers 401 only when there is no Cognito session", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const auth = await requireOrganiser();

    expect(auth.error?.status).toBe(401);
    await expect(auth.error!.json()).resolves.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(mocks.resolveOrganiserSession).not.toHaveBeenCalled();
  });

  // A signed-in account with no organiser row used to be told its session had
  // expired, halfway through publishing an event (issue #302).
  it("answers 403 for a valid session that manages no organiser", async () => {
    mocks.getServerSession.mockResolvedValue(COGNITO);
    mocks.resolveOrganiserSession.mockResolvedValue(null);

    const auth = await requireOrganiser();

    expect(auth.error?.status).toBe(403);
    const body = await auth.error!.json();
    expect(body.code).toBe("NO_ORGANISER");
    expect(body.error).toContain("organiser profile");
  });

  // Collapsing this into the 403 told a working organiser their account was not
  // an organiser whenever the database blipped, which reads as data loss.
  it("answers 503 when the lookup itself fails", async () => {
    mocks.getServerSession.mockResolvedValue(COGNITO);
    mocks.resolveOrganiserSession.mockRejectedValue(new Error("connection terminated"));

    const auth = await requireOrganiser();

    expect(auth.error?.status).toBe(503);
    const body = await auth.error!.json();
    expect(body.code).toBe("UNAVAILABLE");
    expect(body.error).not.toContain("organiser profile");
  });
});
