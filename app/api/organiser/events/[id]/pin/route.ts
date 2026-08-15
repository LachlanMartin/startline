import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrganiserSession } from "@/lib/amplify-server";
import { idParams } from "@/lib/schemas";
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  try {
    const event = await prisma.event.findUnique({
      where:  { id },
      select: { organiserId: true, isPinned: true },
    });

    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    if (event.organiserId !== session.sub)
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const updated = await prisma.event.update({
      where: { id },
      data:  { isPinned: !event.isPinned },
      select: { id: true, isPinned: true },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
}
