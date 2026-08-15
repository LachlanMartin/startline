import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { idParams } from "@/lib/schemas";

export const dynamic = "force-dynamic";

// GET /api/admin/organisers/[id]/members
// Read-only member list for an organiser (admin portal).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  try {
    const members = await prisma.organiserMember.findMany({
      where:  { organiserId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json({ members });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
