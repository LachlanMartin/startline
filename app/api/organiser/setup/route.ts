import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { z } from "zod";

const setupSchema = z.object({ orgName: z.string().max(200) });

export async function POST(req: Request) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const parsed = setupSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Organisation name is required." }, { status: 400 });
  }
  const { orgName } = parsed.data;
  if (!orgName.trim()) {
    return NextResponse.json({ error: "Organisation name is required." }, { status: 400 });
  }

  const existing = await prisma.organiserMember.findFirst({
    where: { userId: session.sub },
    select: { organiser: { select: { id: true, orgName: true } } },
  });
  if (existing) {
    return NextResponse.json(existing.organiser);
  }

  try {
    const organiser = await prisma.$transaction(async (tx) => {
      const org = await tx.organiser.create({
        data: {
          createdBy: session.sub,
          email: session.email,
          orgName: orgName.trim(),
          verified: false,
          status: "APPROVED",
          abn: "",
          photos: [],
        },
        select: { id: true, orgName: true },
      });

      await tx.organiserMember.create({
        data: {
          organiserId: org.id,
          userId: session.sub,
          role: "OWNER",
        },
      });

      return org;
    });

    return NextResponse.json(organiser);
  } catch (err) {
    console.error("Organiser setup error:", err);
    return NextResponse.json({ error: "Failed to create organiser profile." }, { status: 500 });
  }
}
