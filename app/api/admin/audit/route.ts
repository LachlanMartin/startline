import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { z } from "zod";

const auditQuery = z.object({
  action: z.string().max(100).catch(""),
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(50),
});

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const { action, page, limit } = auditQuery.parse(Object.fromEntries(searchParams));
  const skip = (page - 1) * limit;

  const where = action
    ? { action: { contains: action, mode: "insensitive" as const } }
    : {};

  try {
    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          targetType: true,
          targetId: true,
          meta: true,
          createdAt: true,
          admin: { select: { id: true, email: true, name: true } },
        },
        skip,
        take: limit,
      }),
      prisma.adminAuditLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("Admin audit log fetch error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
