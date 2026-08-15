import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { writeAuditLog } from "@/lib/audit";
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

    if (action === "delete") {
      const result = await prisma.event.deleteMany({ where: { id: { in: ids } } });
      affected = result.count;
    } else {
      const newStatus = action === "approve" ? "APPROVED" : "REJECTED";
      const result = await prisma.event.updateMany({
        where: { id: { in: ids }, status: "PENDING" },
        data: {
          status: newStatus,
          reviewedById: session.sub,
          reviewedAt: new Date(),
          ...(action === "reject"
            ? { rejectionReason: reason!.trim() }
            : { rejectionReason: null }),
        },
      });
      affected = result.count;
    }

    writeAuditLog({
      adminId: session.sub,
      action: `BULK_${action.toUpperCase()}`,
      targetType: "event",
      targetId: ids.join(","),
      meta: { count: affected, reason: reason ?? null },
    });

    return NextResponse.json({ ok: true, affected });
  } catch (err) {
    console.error("Admin bulk action error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
