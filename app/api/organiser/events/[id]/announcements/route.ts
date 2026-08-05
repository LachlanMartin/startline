import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrganiserSession } from "@/lib/amplify-server";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { stripHtml } from "@/lib/utils";
// GET /api/organiser/events/[id]/announcements
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;

  try {
    const event = await prisma.event.findUnique({
      where:  { id },
      select: { organiserId: true },
    });
    if (!event)                          return NextResponse.json({ error: "Not found." },  { status: 404 });
    if (event.organiserId !== session.sub) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const announcements = await prisma.announcement.findMany({
      where:   { eventId: id },
      orderBy: { createdAt: "desc" },
      select:  { id: true, title: true, body: true, createdAt: true },
    });

    return NextResponse.json(announcements);
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

// POST /api/organiser/events/[id]/announcements
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;

  try {
    const event = await prisma.event.findUnique({
      where:  { id },
      select: { organiserId: true, status: true },
    });
    if (!event)                            return NextResponse.json({ error: "Not found." },  { status: 404 });
    if (event.organiserId !== session.sub) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (event.status !== "APPROVED")       return NextResponse.json({ error: "Announcements can only be posted for live events." }, { status: 409 });

    const body = await req.json();
    const { title, body: text } = body as { title?: string; body?: string };

    if (!title?.trim()) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    if (!text || !stripHtml(text)) {
      return NextResponse.json({ error: "Body is required." }, { status: 400 });
    }

    const announcement = await prisma.announcement.create({
      data: {
        eventId:     id,
        organiserId: session.sub,
        title:       title.trim(),
        body:        sanitizeHtml(text.trim()),
      },
      select: { id: true, title: true, body: true, createdAt: true },
    });

    return NextResponse.json(announcement, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

// DELETE /api/organiser/events/[id]/announcements/[announcementId] — handled separately
