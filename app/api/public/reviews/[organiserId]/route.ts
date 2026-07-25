import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { displayNameFromUser, getPublishedOrganiserReviews } from "@/lib/reviews";

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

function ratingOk(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5;
}

async function assertPublicOrganiser(organiserId: string) {
  return prisma.organiser.findFirst({
    where: { id: organiserId, status: "APPROVED" },
    select: { id: true },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ organiserId: string }> }
) {
  const { organiserId } = await params;
  const organiser = await assertPublicOrganiser(organiserId);
  if (!organiser) {
    return NextResponse.json({ error: "Organiser not found." }, { status: 404 });
  }

  const reviews = await getPublishedOrganiserReviews(organiserId);
  return NextResponse.json({ reviews });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ organiserId: string }> }
) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to write a review." }, { status: 401 });
  }

  const { organiserId } = await params;
  const organiser = await assertPublicOrganiser(organiserId);
  if (!organiser) {
    return NextResponse.json({ error: "Organiser not found." }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, name: true, username: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Sign in to write a review." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON.");
  }

  const overallRating = body.overallRating;
  if (!ratingOk(overallRating)) {
    return badRequest("Overall rating must be an integer from 1 to 5.");
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const reviewBody = typeof body.body === "string" ? body.body.trim() : "";

  if (!title || title.length > 100) return badRequest("Title is required (max 100 characters).");
  if (!reviewBody || reviewBody.length > 800) return badRequest("Review body is required (max 800 characters).");

  const optionalRating = (v: unknown) => {
    if (v == null || v === "") return null;
    if (!ratingOk(v)) return undefined;
    return v;
  };

  const atmosphereRating = optionalRating(body.atmosphereRating);
  const organisationRating = optionalRating(body.organisationRating);
  const experienceRating = optionalRating(body.experienceRating);
  if (atmosphereRating === undefined || organisationRating === undefined || experienceRating === undefined) {
    return badRequest("Sub-ratings must be integers from 1 to 5 when provided.");
  }

  let eventId: string | null = null;
  let eventTitle: string | null = null;
  if (typeof body.eventId === "string" && body.eventId) {
    const event = await prisma.event.findFirst({
      where: { id: body.eventId, organiserId, status: "APPROVED" },
      select: { id: true, title: true },
    });
    if (!event) return badRequest("Event not found for this organiser.");
    eventId = event.id;
    eventTitle = event.title;
  }

  const reviewerName = displayNameFromUser(user);

  try {
    const created = await prisma.review.create({
      data: {
        organiserId,
        userId: user.id,
        eventId,
        eventTitle,
        overallRating,
        atmosphereRating,
        organisationRating,
        experienceRating,
        title,
        body: reviewBody,
        reviewerName,
        isVerified: false,
        isPublished: true,
      },
      select: { id: true, reviewerName: true, eventId: true, eventTitle: true },
    });
    return NextResponse.json({
      id: created.id,
      reviewerName: created.reviewerName,
      eventId: created.eventId,
      eventTitle: created.eventTitle,
      ok: true,
    }, { status: 201 });
  } catch (err) {
    console.error("Public review create error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
