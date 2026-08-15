import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { writeAuditLog } from "@/lib/audit";
import { idParams } from "@/lib/schemas";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  try {
    const organiser = await prisma.organiser.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!organiser) {
      return NextResponse.json({ error: "Organiser not found." }, { status: 404 });
    }

    const newStatus = organiser.status === "SUSPENDED" ? "APPROVED" : "SUSPENDED";

    const updated = await prisma.organiser.update({
      where: { id },
      data: { status: newStatus },
      select: { id: true, status: true },
    });

    writeAuditLog({
      adminId: session.sub,
      action: newStatus === "SUSPENDED" ? "SUSPEND_ORGANISER" : "ACTIVATE_ORGANISER",
      targetType: "organiser",
      targetId: id,
      meta: { prevStatus: organiser.status, newStatus },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Admin suspend toggle error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
