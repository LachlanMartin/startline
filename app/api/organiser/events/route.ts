import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/amplify-server";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import { archivePastEvents } from "@/lib/archive-events";
import { getEventCoords } from "@/lib/australia-coords";
import { notifyOrganiserFollowers } from "@/lib/notify-organiser-followers";
import { organiserEventPayloadSchema } from "@/lib/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { withUniqueSlug } from "@/lib/slugs";
import { hasAbn, ABN_REQUIRED_MESSAGE } from "@/lib/abn";
export async function GET() {
  await archivePastEvents();
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

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
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  const blocked = await rateLimit(req, {
    prefix: "event-create",
    limit: 50,
    windowSeconds: 3600,
    identifier: session.sub,
  });
  if (blocked) return blocked;

  const parsed = organiserEventPayloadSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }
  const body = parsed.data;
  const { submit, organiserId: requestedOrganiserId } = body;

  // Multi-org scoping: the organiser portal sends the active organiserId (the
  // same one the listing pages resolve) so create/list always agree. Verify
  // membership when it differs from the resolved active organiser, then use it
  // for the ABN gate and APPROVED/PENDING decision too.
  let organiserId = session.sub;
  let verified    = session.verified;
  if (requestedOrganiserId && requestedOrganiserId !== session.sub) {
    const cognitoSession = await getServerSession();
    if (!cognitoSession) {
      return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
    }
    const membership = await prisma.organiserMember.findFirst({
      where: {
        organiserId: requestedOrganiserId,
        user: { cognitoSub: cognitoSession.sub },
      },
      select: { organiser: { select: { id: true, verified: true } } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Not a member of that organiser." }, { status: 403 });
    }
    organiserId = membership.organiser.id;
    verified    = membership.organiser.verified;
  }

  if (submit) {
    const required = ["title", "discipline", "eventDate", "startTime", "city", "state", "format", "level"] as const;
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

  // A missing ABN no longer blocks the organiser from finishing their event.
  // It used to reject the whole submission at the last step, after five steps
  // and an image upload, which read as losing the work. It now costs the event
  // its auto-approval instead: the listing saves, and an admin has to add the
  // missing detail before it can go live.
  const registrationType = body.registrationType ?? "startline";
  const needsAbn = registrationType === "startline";
  let abnOk = true;
  if (needsAbn) {
    const org = await prisma.organiser.findUnique({
      where: { id: organiserId },
      select: { abn: true },
    });
    abnOk = hasAbn(org?.abn);
  }

  // Verified organisers normally skip review. Not without an ABN: auto-approving
  // would put a paid listing live with no ABN attached, which is the outcome the
  // requirement exists to prevent, and the admin would never see it.
  const eventStatus = submit
    ? (verified && abnOk ? "APPROVED" : "PENDING")
    : "DRAFT";

  try {
    const event = await withUniqueSlug(body.title ?? "", (slug) =>
      prisma.event.create({
      data: {
        organiserId,
        status:           eventStatus,
        slug,
        title:            body.title ?? "",
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
        refundTiers:      body.refundTiers       ?? [],
        refundPolicy:     body.refundPolicy      ?? null,
        registrationType,
        feeStructure:     body.feeStructure      ?? "athlete",
        registrationUrl:  body.registrationUrl   ?? null,
        accessibilityInfo: body.accessibilityInfo ?? null,
        coverImageUrl:    body.coverImageUrl      ?? null,
        informationPdfs:  Array.isArray(body.informationPdfs) ? body.informationPdfs : [],
        photos:           Array.isArray(body.photos) ? body.photos : [],
      },
      }),
    );

    if (event.status === "APPROVED") {
      // Awaited, not fired and forgotten: Amplify's compute freezes the
      // container once the response is returned, so a floating promise is
      // dropped at random. A notify failure still must not fail the publish.
      await prisma.organiser
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

    // The organiser finds out here, once the work is saved, rather than being
    // turned away at the last step with nothing kept.
    return NextResponse.json({
      id:     event.id,
      status: event.status,
      ...(submit && !abnOk ? { abnRequired: true, notice: ABN_REQUIRED_MESSAGE } : {}),
    });
  } catch (err) {
    console.error("Event create error:", err);
    return NextResponse.json({ error: "Failed to save event." }, { status: 500 });
  }
}
