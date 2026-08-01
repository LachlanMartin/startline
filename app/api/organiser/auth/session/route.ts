import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/amplify-server";

export async function POST() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { cognitoSub: session.sub },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ hasOrganiser: false, error: "No user record found." }, { status: 404 });
    }

    const membership = await prisma.organiserMember.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });

    return NextResponse.json({ hasOrganiser: !!membership });
  } catch (err) {
    console.error("Organiser auth session error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
