import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import { canAddMember, MAX_ORGS_PER_USER } from "@/lib/organiser-members";
import { z } from "zod";

const addMemberSchema = z.object({ email: z.string().max(255) });

// GET /api/organiser/members
// Lists all members of the active organiser.
export async function GET() {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  try {
    const members = await prisma.organiserMember.findMany({
      where:  { organiserId: session.sub },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const userSession = await getUserSession();
    const currentMember = userSession
      ? await prisma.organiserMember.findFirst({
          where: { organiserId: session.sub, userId: userSession.sub },
          select: { id: true },
        })
      : null;

    return NextResponse.json({
      members,
      role: session.role,
      currentMemberId: currentMember?.id ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

// POST /api/organiser/members
// Body: { email } — adds the user (who must already have a User account) as a MANAGER member.
// Owner only.
export async function POST(req: NextRequest) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let email = "";
  try {
    const parsed = addMemberSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    email = parsed.data.email.trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "No account found for that email." }, { status: 404 });
    }
    if (user.id === session.sub) {
      return NextResponse.json({ error: "That user is already a member." }, { status: 400 });
    }

    const existing = await prisma.organiserMember.findUnique({
      where: { organiserId_userId: { organiserId: session.sub, userId: user.id } },
    });
    const membershipCount = await prisma.organiserMember.count({ where: { userId: user.id } });

    const check = canAddMember(Boolean(existing), membershipCount);
    if (!check.allowed) {
      return NextResponse.json({ error: check.reason }, { status: 400 });
    }

    const membership = await prisma.organiserMember.create({
      data: { organiserId: session.sub, userId: user.id, role: "MANAGER" },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json({ member: membership }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
