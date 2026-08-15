import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrganiserSession } from "@/lib/amplify-server";
import { z } from "zod";

const organiserProfileSchema = z.object({
  orgName: z.string().max(200),
  contactName: z.string().max(200),
  contactEmail: z.string().max(255),
  phone: z.string().max(50),
  abn: z.string().max(20).nullable().optional(),
  website: z.string().max(500).nullable().optional(),
  instagram: z.string().max(500).nullable().optional(),
  facebook: z.string().max(500).nullable().optional(),
  bio: z.string().max(5000).nullable().optional(),
  logoUrl: z.string().max(3000).nullable().optional(),
  logoPosition: z.string().max(100).nullable().optional(),
  coverImageUrl: z.string().max(3000).nullable().optional(),
  coverPosition: z.string().max(100).nullable().optional(),
  photos: z.array(z.string().max(3000)).optional(),
  legalName: z.string().max(300).nullable().optional(),
  insuranceDeclared: z.boolean().optional(),
  dob: z.string().max(20).nullable().optional(),
});

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

  const parsed = organiserProfileSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }
  const {
    orgName, contactName, contactEmail, phone,
    abn, website, instagram, facebook, bio,
    logoUrl, logoPosition, coverImageUrl, coverPosition, photos,
    legalName, insuranceDeclared, dob,
  } = parsed.data;

  if (!orgName || !contactName || !phone || !contactEmail) {
    return NextResponse.json(
      { error: "Organisation name, contact name, phone and contact email are required." },
      { status: 400 },
    );
  }

  // Legal identity fields (ABN, legal name, DOB, insurance) are owner-level:
  // they underpin Stripe payouts and liability. MANAGERs may edit the rest.
  const hasIdentityFields = abn !== undefined || legalName !== undefined ||
    dob !== undefined || insuranceDeclared !== undefined;
  if (hasIdentityFields && session.role !== "OWNER") {
    return NextResponse.json(
      { error: "Only an Owner can update legal identity details." },
      { status: 403 },
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
