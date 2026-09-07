import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { writeAuditLog } from "@/lib/audit";
import { hasAbn } from "@/lib/abn";
import { z } from "zod";

const bulkActionSchema = z.object({
  ids: z.array(z.string().min(1).max(255)).min(1).max(50),
  action: z.enum(["approve", "reject", "delete"]),
  reason: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsed = bulkActionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }
  const { ids, action, reason } = parsed.data;

  if (action === "reject" && !reason?.trim()) {
    return NextResponse.json({ error: "A rejection reason is required for bulk reject." }, { status: 400 });
  }

  try {
    let affected = 0;
    let blocked: { id: string; title: string; reason: string }[] = [];

    if (action === "delete") {
      const result = await prisma.event.deleteMany({ where: { id: { in: ids } } });
      affected = result.count;
    } else {
      let approvable = ids;

      // Bulk approve used to write straight through, so it could publish an
      // event that the single-approve route refuses. Both gates are re-checked
      // here or the rule is one checkbox away from being bypassed. The ABN test
      // counts digits, which SQL cannot express, so the partition happens here
      // rather than in the where clause.
      if (action === "approve") {
        const candidates = await prisma.event.findMany({
          where:  { id: { in: ids }, status: "PENDING" },
          select: {
            id: true, title: true, registrationType: true,
            organiser: { select: { abn: true, stripeOnboardingComplete: true } },
          },
        });
        const blockedFor = (e: (typeof candidates)[number]): string | null => {
          if (e.registrationType !== "startline") return null;
          if (!hasAbn(e.organiser.abn)) return "No ABN on file";
          if (!e.organiser.stripeOnboardingComplete) return "Stripe onboarding incomplete";
          return null;
        };
        blocked = candidates
          .map((e) => ({ id: e.id, title: e.title, reason: blockedFor(e) }))
          .filter((e): e is { id: string; title: string; reason: string } => e.reason !== null);
        const blockedIds = new Set(blocked.map((e) => e.id));
        approvable = ids.filter((id) => !blockedIds.has(id));
      }

      const newStatus = action === "approve" ? "APPROVED" : "REJECTED";
      const result = approvable.length
        ? await prisma.event.updateMany({
            where: { id: { in: approvable }, status: "PENDING" },
            data: {
              status: newStatus,
              reviewedById: session.sub,
              reviewedAt: new Date(),
              ...(action === "reject"
                ? { rejectionReason: reason!.trim() }
                : { rejectionReason: null }),
            },
          })
        : { count: 0 };
      affected = result.count;
    }

    writeAuditLog({
      adminId: session.sub,
      action: `BULK_${action.toUpperCase()}`,
      targetType: "event",
      targetId: ids.join(","),
      meta: { count: affected, reason: reason ?? null, blocked: blocked.length },
    });

    return NextResponse.json({ ok: true, affected, blocked });
  } catch (err) {
    console.error("Admin bulk action error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
