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
      select: { id: true, verified: true },
    });

    if (!organiser) {
      return NextResponse.json({ error: "Organiser not found." }, { status: 404 });
    }

    const updated = await prisma.organiser.update({
      where: { id },
      data:  { verified: !organiser.verified },
      select: { id: true, verified: true },
    });

    writeAuditLog({
      adminId: session.sub,
      action: updated.verified ? "VERIFY_ORGANISER" : "UNVERIFY_ORGANISER",
      targetType: "organiser",
      targetId: id,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Admin verify toggle error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
