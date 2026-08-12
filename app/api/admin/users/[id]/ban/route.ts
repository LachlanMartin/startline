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
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, isBanned: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isBanned: !user.isBanned },
      select: { id: true, isBanned: true },
    });

    writeAuditLog({
      adminId: session.sub,
      action: updated.isBanned ? "BAN_USER" : "UNBAN_USER",
      targetType: "user",
      targetId: id,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Admin ban toggle error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
