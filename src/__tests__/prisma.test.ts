import { describe, it, expect } from "vitest";
import prisma from "@/lib/prisma";

describe("prisma", () => {
  it("exports a Prisma client instance", () => {
    expect(prisma).toBeDefined();
    expect(typeof prisma.$connect).toBe("function");
    expect(typeof prisma.$disconnect).toBe("function");
  });

  it("has expected model delegates", () => {
    expect(prisma.event).toBeDefined();
    expect(prisma.organiser).toBeDefined();
    expect(prisma.admin).toBeDefined();
    expect(prisma.review).toBeDefined();
    expect(prisma.registration).toBeDefined();
    expect(prisma.organiserFollow).toBeDefined();
  });
});
