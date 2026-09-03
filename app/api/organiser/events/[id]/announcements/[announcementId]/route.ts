import { NextRequest, NextResponse } from "next/server";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { idAnnouncementIdParams } from "@/lib/schemas";
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; announcementId: string }> },
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  const parsedParams = idAnnouncementIdParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { announcementId } = parsedParams.data;

  try {
    const ann = await prisma.announcement.findUnique({
      where:  { id: announcementId },
      select: { organiserId: true },
    });

    if (!ann)                              return NextResponse.json({ error: "Not found." },  { status: 404 });
    if (ann.organiserId !== session.sub)   return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    await prisma.announcement.delete({ where: { id: announcementId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
