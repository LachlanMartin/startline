import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrganiserSession } from "@/lib/amplify-server";
import { archivePastEvents } from "@/lib/archive-events";
import { getEventCoords } from "@/lib/australia-coords";
import { notifyOrganiserFollowers } from "@/lib/notify-organiser-followers";
export async function GET() {
  await archivePastEvents();
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  try {
    const events = await prisma.event.findMany({
      where:   { organiserId: session.sub },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, title: true, discipline: true, city: true, state: true,
        eventDate: true, startTime: true, status: true, createdAt: true,
        waves: true, registrationType: true, feeStructure: true, registrationUrl: true, cap: true, isPinned: true,
        coverImageUrl: true,
        _count: { select: { registrations: true } },
      },
    });
    return NextResponse.json(
      events.map(({ _count, ...rest }: { _count: { registrations: number } }) => ({ ...rest, registrationCount: _count.registrations }))
    );
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const body = await req.json();
  const { submit } = body;

  if (submit) {
    const required = ["title", "discipline", "eventDate", "startTime", "city", "state", "format", "level"];
    for (const field of required) {
      if (!body[field]) return NextResponse.json({ error: `${field} is required.` }, { status: 400 });
    }
    if (body.registrationType === "external" && !body.registrationUrl) {
      return NextResponse.json({ error: "registrationUrl is required for external registrations." }, { status: 400 });
    }
  } else {
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "A title is required to save a draft." }, { status: 400 });
    }
  }

  const registrationType = body.registrationType ?? "startline";
  if (registrationType === "startline") {
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

  const eventStatus = submit
    ? (session.verified ? "APPROVED" : "PENDING")
    : "DRAFT";

  try {
    const event = await prisma.event.create({
      data: {
        organiserId:      session.sub,
        status:           eventStatus,
        title:            body.title,
        discipline:       body.discipline        ?? "",
        description:      body.description       ?? null,
        eventDate:        body.eventDate         ?? "",
        endDate:          body.endDate           ?? null,
        startTime:        body.startTime         ?? "",
        endTime:          body.endTime           || "",
        venue:            body.venue             ?? "",
        address:          body.address           ?? null,
        city:             body.city              ?? "",
        state:            body.state             ?? "",
        latitude:         body.latitude          ?? (body.city && body.state ? getEventCoords(body.city, body.state)[0] : null),
        longitude:        body.longitude         ?? (body.city && body.state ? getEventCoords(body.city, body.state)[1] : null),
        format:           body.format            ?? "",
        level:            body.level             ?? "",
        categories:       body.categories        ?? [],
        cap:              body.cap               ?? null,
        minAge:           body.minAge            ?? 16,
        waves:            body.waves             ?? [],
        inclusions:       body.inclusions        ?? null,
        extras:           body.extras            ?? null,
        activations:      body.activations       ?? null,
        refundPolicy:     body.refundPolicy      ?? null,
        registrationType,
        feeStructure:     body.feeStructure      ?? "athlete",
        registrationUrl:  body.registrationUrl   ?? null,
        accessibilityInfo: body.accessibilityInfo ?? null,
        coverImageUrl:    body.coverImageUrl      ?? null,
        informationPdfUrl: body.informationPdfUrl ?? null,
        photos:           Array.isArray(body.photos) ? body.photos : [],
      },
    });

    if (event.status === "APPROVED") {
      prisma.organiser
        .findUnique({ where: { id: event.organiserId }, select: { orgName: true } })
        .then((org) =>
          notifyOrganiserFollowers({
            organiserId: event.organiserId,
            eventId: event.id,
            eventTitle: event.title,
            organiserName: org?.orgName,
            eventDate: event.eventDate || null,
            city: event.city || null,
          }),
        )
        .catch((err) => console.error("Follower notify failed:", err));
    }

    return NextResponse.json({ id: event.id, status: event.status });
  } catch (err) {
    console.error("Event create error:", err);
    return NextResponse.json({ error: "Failed to save event." }, { status: 500 });
  }
}
