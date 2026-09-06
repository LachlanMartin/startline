import { NextRequest, NextResponse } from "next/server";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { shiftIsoDate } from "@/lib/duplicate-event";
import { idParams } from "@/lib/schemas";
import { withUniqueSlug } from "@/lib/slugs";

/** POST /api/organiser/events/[id]/duplicate — copy listing fields into a new DRAFT (+7 days). */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  try {
    const source = await prisma.event.findUnique({ where: { id } });
    if (!source) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (source.organiserId !== session.sub) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const eventDate = shiftIsoDate(source.eventDate, 7) ?? source.eventDate;
    const endDate = source.endDate ? shiftIsoDate(source.endDate, 7) : null;

    const draft = await withUniqueSlug(source.title, (slug) =>
      prisma.event.create({
      data: {
        organiserId: source.organiserId,
        status: "DRAFT",
        slug,
        title: source.title,
        discipline: source.discipline,
        description: source.description,
        eventDate,
        endDate,
        startTime: source.startTime,
        endTime: source.endTime,
        venue: source.venue,
        address: source.address,
        city: source.city,
        state: source.state,
        format: source.format,
        level: source.level,
        categories: source.categories ?? [],
        cap: source.cap,
        minAge: source.minAge,
        waves: source.waves ?? [],
        inclusions: source.inclusions,
        extras: source.extras,
        activations: source.activations,
        refundTiers: source.refundTiers ?? [],
        refundPolicy: source.refundPolicy,
        registrationType: source.registrationType,
        feeStructure: source.feeStructure,
        registrationUrl: source.registrationUrl,
        bagDrop: source.bagDrop,
        parking: source.parking,
        accessibilityInfo: source.accessibilityInfo,
        additionalNotes: source.additionalNotes,
        coverImageUrl: source.coverImageUrl,
        informationPdfs: source.informationPdfs ?? [],
        photos: source.photos ?? [],
      },
      }),
    );

    return NextResponse.json({ id: draft.id });
  } catch (err) {
    console.error("Event duplicate error:", err);
    return NextResponse.json({ error: "Failed to duplicate event." }, { status: 500 });
  }
}
