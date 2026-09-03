import { NextRequest, NextResponse } from "next/server";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const markReadSchema = z.object({ ids: z.array(z.string().min(1).max(255)).optional() });
// GET /api/organiser/notifications
// Returns the 30 most recent notifications; includes unread count in header
export async function GET() {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  try {
    const notifications = await prisma.notification.findMany({
      where:   { organiserId: session.sub },
      orderBy: { createdAt: "desc" },
      take:    30,
      select:  { id: true, type: true, title: true, body: true, eventId: true, read: true, createdAt: true },
    });

    const unreadCount = notifications.filter((n: { read: boolean }) => !n.read).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

// PATCH /api/organiser/notifications
// Body: { ids?: string[] } — if ids omitted, marks ALL as read
export async function PATCH(req: NextRequest) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  try {
    const parsed = markReadSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }
    const ids = parsed.data.ids;

    await prisma.notification.updateMany({
      where: {
        organiserId: session.sub,
        ...(ids?.length ? { id: { in: ids } } : {}),
      },
      data: { read: true },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
