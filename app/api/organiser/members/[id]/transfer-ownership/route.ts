import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrganiserSession } from "@/lib/amplify-server";
import { canTransferOwnership } from "@/lib/organiser-members";
import { idParams } from "@/lib/schemas";

// POST /api/organiser/members/[id]/transfer-ownership
// Atomically promotes the target member to OWNER and demotes the caller
// (the current Owner) to MANAGER. The caller must be the Owner.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  try {
    const target = await prisma.organiserMember.findFirst({
      where:  { id, organiserId: session.sub },
      select: { id: true, role: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    const check = canTransferOwnership(target.role);
    if (!check.allowed) {
      return NextResponse.json({ error: check.reason }, { status: 400 });
    }

    const caller = await prisma.organiserMember.findFirst({
      where:  { organiserId: session.sub, role: "OWNER" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!caller) {
      return NextResponse.json({ error: "No Owner found." }, { status: 500 });
    }

    await prisma.$transaction([
      prisma.organiserMember.update({
        where: { id: target.id },
        data:  { role: "OWNER" },
      }),
      prisma.organiserMember.update({
        where: { id: caller.id },
        data:  { role: "MANAGER" },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
