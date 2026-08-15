import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { displayNameFromUser, getPublishedOrganiserReviews } from "@/lib/reviews";
import { organiserIdParams } from "@/lib/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { assertTurnstile } from "@/lib/turnstile";
import { z } from "zod";

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

const reviewCreateSchema = z.object({
  overallRating: z.number().int().min(1).max(5),
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(800),
  atmosphereRating: z.number().int().min(1).max(5).nullable().optional(),
  organisationRating: z.number().int().min(1).max(5).nullable().optional(),
  experienceRating: z.number().int().min(1).max(5).nullable().optional(),
  eventId: z.string().max(255).nullable().optional(),
  turnstileToken: z.string().max(4000).optional(),
});

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
  const parsedParams = organiserIdParams.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Organiser not found." }, { status: 404 });
  }
  const { organiserId } = parsedParams.data;
  const organiser = await assertPublicOrganiser(organiserId);
  if (!organiser) {
    return NextResponse.json({ error: "Organiser not found." }, { status: 404 });
  }

  const reviews = await getPublishedOrganiserReviews(organiserId);
  return NextResponse.json({ reviews });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ organiserId: string }> }
) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to write a review." }, { status: 401 });
  }

  const parsedParams = organiserIdParams.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Organiser not found." }, { status: 404 });
  }
  const { organiserId } = parsedParams.data;
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

  const blocked = await rateLimit(req, {
    prefix: "review",
    limit: 10,
    windowSeconds: 3600,
    identifier: user.id,
  });
  if (blocked) return blocked;

  const parsed = reviewCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const botBlocked = await assertTurnstile(req, parsed.data, "review");
  if (botBlocked) return botBlocked;

  const existing = await prisma.review.findFirst({
    where: { organiserId, userId: user.id },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({
      error: "You've already reviewed this organiser. You can edit your existing review instead.",
    }, { status: 409 });
  }
  const {
    overallRating,
    title,
    body: reviewBody,
    atmosphereRating,
    organisationRating,
    experienceRating,
    eventId: eventIdInput,
  } = parsed.data;

  let eventId: string | null = null;
  let eventTitle: string | null = null;
  if (eventIdInput) {
    const event = await prisma.event.findFirst({
      where: { id: eventIdInput, organiserId, status: "APPROVED" },
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
