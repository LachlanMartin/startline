import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { organiserIdParams } from "@/lib/schemas";

// GET /api/public/reviews/[organiserId]/mine — the current user's own review of
// this organiser (if any), so the client can offer "edit" instead of a second
// create. Returns { review: null } when signed out or no review exists.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ organiserId: string }> },
) {
  const parsedParams = organiserIdParams.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Organiser not found." }, { status: 404 });
  }
  const { organiserId } = parsedParams.data;

  const session = await getUserSession();
  if (!session) return NextResponse.json({ review: null });

  try {
    const review = await prisma.review.findFirst({
      where: { organiserId, userId: session.sub },
      select: {
        id: true,
        eventId: true,
        eventTitle: true,
        overallRating: true,
        atmosphereRating: true,
        organisationRating: true,
        experienceRating: true,
        title: true,
        body: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ review: review ? { ...review, createdAt: review.createdAt.toISOString() } : null });
  } catch (err) {
    console.error("Fetch own review error:", err);
    return NextResponse.json({ review: null });
  }
}
