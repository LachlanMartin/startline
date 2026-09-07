import { NextRequest, NextResponse } from "next/server";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { canRemoveMember } from "@/lib/organiser-members";
import { idParams } from "@/lib/schemas";

// DELETE /api/organiser/members/[id]
// Removes a member. Owner only. The last Owner cannot be removed.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  try {
    const membership = await prisma.organiserMember.findFirst({
      where:  { id, organiserId: session.sub },
      select: { id: true, role: true },
    });
    if (!membership) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    const superAdminCount = await prisma.organiserMember.count({
      where: { organiserId: session.sub, role: "OWNER" },
    });

    const check = canRemoveMember(membership.role, superAdminCount);
    if (!check.allowed) {
      return NextResponse.json({ error: check.reason }, { status: 400 });
    }

    await prisma.organiserMember.delete({ where: { id: membership.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
