import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/amplify-server";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  if (session.groups.includes("admins")) {
    return NextResponse.json({ role: "admin", hasOrganiser: false });
  }

  const user = await prisma.user.findUnique({
    where: { cognitoSub: session.sub },
    include: { organiser: { select: { id: true } } },
  });

  const hasOrganiser = Boolean(user?.organiser);
  return NextResponse.json({ role: hasOrganiser ? "organiser" : "user", hasOrganiser });
}
