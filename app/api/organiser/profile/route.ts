import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrganiserSession } from "@/lib/amplify-server";

export async function GET() {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  try {
    const organiser = await prisma.organiser.findUnique({
      where:  { id: session.sub },
      select: {
        id: true, email: true, status: true,
        orgName: true, contactName: true, contactEmail: true, phone: true,
        abn: true, website: true, instagram: true, facebook: true,
        bio: true, logoUrl: true, logoPosition: true, coverImageUrl: true, coverPosition: true, photos: true,
        legalName: true, insuranceDeclared: true, dob: true,
        stripeAccountId: true, stripeOnboardingComplete: true,
        _count: { select: { follows: true } },
      },
    });

    if (!organiser) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const { _count, ...rest } = organiser;
    return NextResponse.json({ ...rest, followerCount: _count.follows });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const body = await req.json();
  const {
    orgName, contactName, contactEmail, phone,
    abn, website, instagram, facebook, bio,
    logoUrl, logoPosition, coverImageUrl, coverPosition, photos,
    legalName, insuranceDeclared, dob,
  } = body;

  if (!orgName || !contactName || !phone || !contactEmail) {
    return NextResponse.json(
      { error: "Organisation name, contact name, phone and contact email are required." },
      { status: 400 },
    );
  }

  try {
    await prisma.organiser.update({
      where: { id: session.sub },
      data: {
        orgName, contactName, contactEmail, phone,
        abn, website, instagram, facebook, bio,
        logoUrl, logoPosition, coverImageUrl, coverPosition, photos,
        ...(legalName !== undefined        ? { legalName }         : {}),
        ...(insuranceDeclared !== undefined ? { insuranceDeclared } : {}),
        ...(dob !== undefined         ? { dob }              : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
