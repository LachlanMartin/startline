import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { idParams } from "@/lib/schemas";
import { z } from "zod";

const reviewUpdateSchema = z.object({
  overallRating: z.number().int().min(1).max(5),
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(800),
  atmosphereRating: z.number().int().min(1).max(5).nullable().optional(),
  organisationRating: z.number().int().min(1).max(5).nullable().optional(),
  experienceRating: z.number().int().min(1).max(5).nullable().optional(),
  eventId: z.string().max(255).nullable().optional(),
});

// PATCH /api/public/reviews/[id] — owner edits their own review.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to edit a review." }, { status: 401 });
  }

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }
  const { id } = parsedParams.data;

  const review = await prisma.review.findUnique({
    where: { id },
    select: { userId: true, organiserId: true },
  });
  if (!review) return NextResponse.json({ error: "Review not found." }, { status: 404 });
  if (review.userId !== session.sub) {
    return NextResponse.json({ error: "You can only edit your own review." }, { status: 403 });
  }

  const parsed = reviewUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  let eventId: string | null = null;
  let eventTitle: string | null = null;
  if (parsed.data.eventId) {
    const event = await prisma.event.findFirst({
      where: { id: parsed.data.eventId, organiserId: review.organiserId, status: "APPROVED" },
      select: { id: true, title: true },
    });
    if (!event) return NextResponse.json({ error: "Event not found for this organiser." }, { status: 400 });
    eventId = event.id;
    eventTitle = event.title;
  }

  try {
    const updated = await prisma.review.update({
      where: { id },
      data: {
        overallRating: parsed.data.overallRating,
        title: parsed.data.title,
        body: parsed.data.body,
        atmosphereRating: parsed.data.atmosphereRating ?? null,
        organisationRating: parsed.data.organisationRating ?? null,
        experienceRating: parsed.data.experienceRating ?? null,
        eventId,
        eventTitle,
      },
      select: { id: true },
    });
    return NextResponse.json({ id: updated.id, ok: true });
  } catch (err) {
    console.error("Review update error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
