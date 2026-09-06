import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: { event: { findMany: mocks.findMany } },
}));

import { withUniqueSlug } from "@/lib/slugs";

/** What Prisma raises when two writes claim the same event slug. */
function slugConflict() {
  return Object.assign(new Error("Unique constraint failed"), {
    code: "P2002",
    meta: { target: ["slug"] },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findMany.mockResolvedValue([]);
});

describe("withUniqueSlug", () => {
  it("passes the resolved slug straight through when nothing collides", async () => {
    const write = vi.fn().mockResolvedValue("created");

    await expect(withUniqueSlug("Sydney Harbour 10K", write)).resolves.toBe("created");
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith("sydney-harbour-10k");
  });

  // uniqueSlug reads the taken slugs before writing, so two events created from
  // the same title at the same moment both resolve to the same string. One of
  // them used to fail the whole request with a bare 500.
  it("re-resolves and retries when a concurrent write took the slug first", async () => {
    mocks.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ slug: "sydney-harbour-10k" }]);
    const write = vi
      .fn()
      .mockRejectedValueOnce(slugConflict())
      .mockResolvedValueOnce("created");

    await expect(withUniqueSlug("Sydney Harbour 10K", write)).resolves.toBe("created");
    expect(write).toHaveBeenNthCalledWith(1, "sydney-harbour-10k");
    expect(write).toHaveBeenNthCalledWith(2, "sydney-harbour-10k-2");
  });

  it("gives up after the attempt limit rather than looping", async () => {
    const write = vi.fn().mockRejectedValue(slugConflict());

    await expect(withUniqueSlug("Sydney Harbour 10K", write)).rejects.toMatchObject({
      code: "P2002",
    });
    expect(write).toHaveBeenCalledTimes(3);
  });

  it("does not retry an unrelated failure", async () => {
    const other = Object.assign(new Error("nope"), { code: "P2003" });
    const write = vi.fn().mockRejectedValue(other);

    await expect(withUniqueSlug("Sydney Harbour 10K", write)).rejects.toThrow("nope");
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("does not retry a unique violation on some other column", async () => {
    const emailClash = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
      meta: { target: ["email"] },
    });
    const write = vi.fn().mockRejectedValue(emailClash);

    await expect(withUniqueSlug("Sydney Harbour 10K", write)).rejects.toThrow();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("keeps the renamed event out of its own collision check", async () => {
    const write = vi.fn().mockResolvedValue("updated");

    await withUniqueSlug("Sydney Harbour 10K", write, { excludeId: "evt_1" });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ NOT: { id: "evt_1" } }) }),
    );
  });
});
