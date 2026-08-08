import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrganiserSession } from "@/lib/amplify-server";
import { getEventCoords } from "@/lib/australia-coords";
import { notifyOrganiserFollowers } from "@/lib/notify-organiser-followers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;

  try {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (event.organiserId !== session.sub) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    return NextResponse.json(event);
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

// PATCH /api/organiser/events/[id] — update an existing draft
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { submit, ...data } = body;

  try {
    const existing = await prisma.event.findUnique({
      where:  { id },
      select: { organiserId: true, status: true },
    });

    if (!existing)
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    if (existing.organiserId !== session.sub)
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (existing.status !== "DRAFT")
      return NextResponse.json({ error: "Only draft events can be updated this way." }, { status: 409 });

    if (submit) {
      const required = ["title", "discipline", "eventDate", "startTime", "city", "state", "format", "level"];
      for (const field of required) {
        if (!data[field]) return NextResponse.json({ error: `${field} is required.` }, { status: 400 });
      }
      if (data.registrationType === "external" && !data.registrationUrl) {
        return NextResponse.json({ error: "registrationUrl is required for external registrations." }, { status: 400 });
      }
    }

    if ((data.registrationType ?? "startline") === "startline") {
      const org = await prisma.organiser.findUnique({
        where: { id: session.sub },
        select: { abn: true },
      });
      const abnDigits = org?.abn?.replace(/\D/g, "") ?? "";
      if (abnDigits.length < 9) {
        return NextResponse.json(
          { error: "An ABN is required to host paid events on Startline. Add your ABN in Payments or onboarding, or use external registration." },
          { status: 400 },
        );
      }
    }

    const nextStatus = submit
      ? (session.verified ? "APPROVED" : "PENDING")
      : "DRAFT";

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

    // Existing was DRAFT (enforced above); notify when submit goes straight to live.
    if (updated.status === "APPROVED") {
      prisma.organiser
        .findUnique({ where: { id: updated.organiserId }, select: { orgName: true } })
        .then((org) =>
          notifyOrganiserFollowers({
            organiserId: updated.organiserId,
            eventId: updated.id,
            eventTitle: updated.title,
            organiserName: org?.orgName,
            eventDate: updated.eventDate || null,
            city: updated.city || null,
          }),
        )
        .catch((err) => console.error("Follower notify failed:", err));
    }

    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (err) {
    console.error("Event update error:", err);
    return NextResponse.json({ error: "Failed to update event." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;

  try {
    const existing = await prisma.event.findUnique({
      where:  { id },
      select: { organiserId: true },
    });

    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (existing.organiserId !== session.sub) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    await prisma.event.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Event delete error:", err);
    return NextResponse.json({ error: "Failed to delete event." }, { status: 500 });
  }
}
