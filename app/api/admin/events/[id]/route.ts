import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { getEventCoords } from "@/lib/australia-coords";
import { writeAuditLog } from "@/lib/audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;

  try {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json(event);
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

// PATCH /api/admin/events/[id] — edit any event, regardless of status.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { submit, ...data } = body;

  try {
    const existing = await prisma.event.findUnique({
      where:  { id },
      select: { title: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    if (submit) {
      const required = ["title", "discipline", "eventDate", "startTime", "city", "state", "format", "level"];
      for (const field of required) {
        if (!data[field]) return NextResponse.json({ error: `${field} is required.` }, { status: 400 });
      }
      if (data.registrationType === "external" && !data.registrationUrl) {
        return NextResponse.json({ error: "registrationUrl is required for external registrations." }, { status: 400 });
      }
    }

    // Live events stay live after an admin edit; everything else re-enters the review queue.
    const nextStatus = submit
      ? (existing.status === "APPROVED" ? "APPROVED" : "PENDING")
      : existing.status;

    const updated = await prisma.event.update({
      where: { id },
      data: {
        title:             data.title             ?? undefined,
        discipline:        data.discipline        ?? undefined,
        description:       data.description       ?? undefined,
        eventDate:         data.eventDate         ?? undefined,
        endDate:           data.endDate           ?? null,
        startTime:         data.startTime         ?? undefined,
        endTime:           data.endTime           ?? undefined,
        venue:             data.venue             ?? undefined,
        address:           data.address           ?? undefined,
        city:              data.city              ?? undefined,
        state:             data.state             ?? undefined,
        latitude:          data.latitude          ?? (data.city && data.state ? getEventCoords(data.city, data.state)[0] : null),
        longitude:         data.longitude         ?? (data.city && data.state ? getEventCoords(data.city, data.state)[1] : null),
        format:            data.format            ?? undefined,
        level:             data.level             ?? undefined,
        categories:        data.categories        ?? undefined,
        cap:               data.cap               ?? null,
        minAge:            data.minAge            ?? undefined,
        waves:             data.waves             ?? undefined,
        inclusions:        data.inclusions        ?? undefined,
        extras:            data.extras            ?? undefined,
        activations:       data.activations       ?? undefined,
        refundPolicy:      data.refundPolicy      ?? undefined,
        registrationType:  data.registrationType  ?? undefined,
        feeStructure:      data.feeStructure      ?? undefined,
        registrationUrl:   data.registrationUrl   ?? undefined,
        accessibilityInfo: data.accessibilityInfo ?? undefined,
        coverImageUrl:     data.coverImageUrl     ?? undefined,
        informationPdfUrl: data.informationPdfUrl === undefined ? undefined : data.informationPdfUrl,
        photos:            Array.isArray(data.photos) ? data.photos : undefined,
        status:            nextStatus,
      },
    });

    writeAuditLog({
      adminId: session.sub,
      action: "EDIT_EVENT",
      targetType: "event",
      targetId: id,
      meta: { title: updated.title, status: nextStatus },
    });

    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (err) {
    console.error("Admin event update error:", err);
    return NextResponse.json({ error: "Failed to update event." }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;

  try {
    const event = await prisma.event.findUnique({
      where: { id },
      select: { id: true, title: true, status: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    await prisma.event.delete({ where: { id } });

    writeAuditLog({
      adminId: session.sub,
      action: "DELETE_EVENT",
      targetType: "event",
      targetId: id,
      meta: { title: event.title, status: event.status },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin delete event error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
