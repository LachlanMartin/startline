import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";

// GET /api/user/notifications — the 30 most recent notifications for the athlete.
export async function GET() {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  try {
    const notifications = await prisma.userNotification.findMany({
      where:   { userId: session.sub },
      orderBy: { createdAt: "desc" },
      take:    30,
      select:  { id: true, type: true, title: true, body: true, eventId: true, read: true, createdAt: true },
    });

    const unreadCount = notifications.filter((n) => !n.read).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

// PATCH /api/user/notifications — mark read. Body: { ids?: string[] } (omit = all).
export async function PATCH(req: NextRequest) {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({})) as { ids?: string[] };

    await prisma.userNotification.updateMany({
      where: {
        userId: session.sub,
        ...(body.ids?.length ? { id: { in: body.ids } } : {}),
      },
      data: { read: true },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
