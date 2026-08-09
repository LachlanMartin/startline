import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { getEventCoords } from "@/lib/australia-coords";
import { writeAuditLog } from "@/lib/audit";

const VALID_STATUSES = ["DRAFT", "PENDING", "APPROVED", "REJECTED", "ARCHIVED"] as const;
type EventStatus = (typeof VALID_STATUSES)[number];

const EVENT_SELECT = {
  id:              true,
  title:           true,
  discipline:      true,
  city:            true,
  state:           true,
  eventDate:       true,
  startTime:       true,
  status:          true,
  isPinned:        true,
  createdAt:       true,
  coverImageUrl:   true,
  rejectionReason: true,
  reviewedAt:      true,
  organiser: {
    select: {
      id:          true,
      orgName:     true,
      contactName: true,
      email:       true,
    },
  },
} as const;

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const statusParam = (searchParams.get("status") ?? "PENDING").toUpperCase();
  const status: EventStatus = (VALID_STATUSES as readonly string[]).includes(statusParam)
    ? (statusParam as EventStatus)
    : "PENDING";

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
  const skip = (page - 1) * limit;

  try {
    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where:   { status },
        orderBy: { createdAt: "desc" },
        select:  EVENT_SELECT,
        skip,
        take: limit,
      }),
      prisma.event.count({ where: { status } }),
    ]);

    const response = NextResponse.json({
      events,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (err) {
    console.error("Admin events fetch error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

// POST /api/admin/events — create an event on behalf of an organiser.
// Body: { organiserId, ...event fields, submit }
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const body = await req.json();
  const { submit, organiserId } = body;

  if (!organiserId) {
    return NextResponse.json({ error: "organiserId is required." }, { status: 400 });
  }

  const organiser = await prisma.organiser.findUnique({
    where:  { id: organiserId },
    select: { id: true, verified: true, status: true, orgName: true },
  });
  if (!organiser) return NextResponse.json({ error: "Organiser not found." }, { status: 404 });
  if (organiser.status === "SUSPENDED") {
    return NextResponse.json({ error: "Cannot create events for a suspended organiser." }, { status: 422 });
  }

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

  const eventStatus = submit ? (organiser.verified ? "APPROVED" : "PENDING") : "DRAFT";

  try {
    const event = await prisma.event.create({
      data: {
        organiserId:      organiserId,
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
        registrationType: body.registrationType  ?? "startline",
        feeStructure:     body.feeStructure      ?? "athlete",
        registrationUrl:  body.registrationUrl   ?? null,
        accessibilityInfo: body.accessibilityInfo ?? null,
        coverImageUrl:    body.coverImageUrl      ?? null,
        informationPdfUrl: body.informationPdfUrl ?? null,
        photos:           Array.isArray(body.photos) ? body.photos : [],
      },
    });

    writeAuditLog({
      adminId: session.sub,
      action: "CREATE_EVENT",
      targetType: "event",
      targetId: event.id,
      meta: { title: body.title, organiserId, status: event.status },
    });

    return NextResponse.json({ id: event.id, status: event.status });
  } catch (err) {
    console.error("Admin event create error:", err);
    return NextResponse.json({ error: "Failed to save event." }, { status: 500 });
  }
}
