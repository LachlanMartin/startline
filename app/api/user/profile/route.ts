import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { validateUsername } from "@/lib/username-validation";
import { getOrganiserRatings } from "@/lib/reviews";
import { GENDER_OPTIONS } from "@/lib/registration-form";

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

const privateSelect = {
  mobile: true,
  dateOfBirth: true,
  gender: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
} as const;

const profileSelect = {
  id: true,
  email: true,
  name: true,
  username: true,
  bio: true,
  profilePicUrl: true,
  coverImageUrl: true,
  coverPosition: true,
  isPublic: true,
  city: true,
  state: true,
  createdAt: true,
  ...privateSelect,
} as const;

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export async function GET() {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      ...profileSelect,
      memberships: {
        select: {
          organiser: {
            select: { id: true, orgName: true, logoUrl: true, verified: true },
          },
        },
        take: 1,
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!user) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const registrations = await prisma.registration.findMany({
    where: { userId: session.sub, status: "CONFIRMED" },
    orderBy: { event: { eventDate: "asc" } },
    select: {
      id: true,
      finishTime: true,
      result: true,
      resultDistance: true,
      resultTime: true,
      resultPlacement: true,
      isPersonalBest: true,
      isTopResult: true,
      category: true,
      event: {
        select: {
          id: true,
          title: true,
          discipline: true,
          eventDate: true,
          city: true,
          state: true,
          coverImageUrl: true,
          organiser: { select: { id: true, orgName: true, logoUrl: true } },
        },
      },
    },
  });

  const completed = registrations.length;
  const ratings = await getOrganiserRatings(
    registrations.map((r) => r.event.organiser.id),
  );
  const historyRegistrations = registrations.map((r) => ({
    ...r,
    event: {
      ...r.event,
      organiser: {
        ...r.event.organiser,
        rating: ratings.get(r.event.organiser.id) ?? null,
      },
    },
  }));

  const { memberships, ...profile } = user;
  return NextResponse.json({
    ...profile,
    organiser: memberships[0]?.organiser ?? null,
    // Prefer profile-saved values; fall back to Cognito attributes for older accounts.
    mobile: user.mobile ?? session.phoneNumber ?? null,
    dateOfBirth: user.dateOfBirth ?? session.birthdate ?? null,
    history: {
      completed,
      registrations: historyRegistrations,
    },
  });
}

export async function PUT(req: Request) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if ("name" in body) data.name = normalizeOptionalString(body.name);

  if ("username" in body) {
    const username = body.username?.trim()?.toLowerCase() || null;
    if (username) {
      const current = await prisma.user.findUnique({
        where: { id: session.sub },
        select: { username: true },
      });
      // Allow keeping an existing handle even if it later became reserved
      // (e.g. seed users created before the reserved list grew).
      if (current?.username !== username) {
        const validation = validateUsername(username);
        if (!validation.valid) return badRequest(validation.reason);

        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing && existing.id !== session.sub) {
          return badRequest("This username is already taken.");
        }
      }
    }
    data.username = username;
  }

  if ("bio" in body) data.bio = normalizeOptionalString(body.bio);
  if ("profilePicUrl" in body) data.profilePicUrl = body.profilePicUrl || null;
  if ("coverImageUrl" in body) data.coverImageUrl = body.coverImageUrl || null;
  if ("coverPosition" in body) data.coverPosition = body.coverPosition || "50% 50%";
  if ("isPublic" in body) data.isPublic = body.isPublic;
  if ("city" in body) data.city = normalizeOptionalString(body.city);
  if ("state" in body) data.state = normalizeOptionalString(body.state);

  if ("mobile" in body) data.mobile = normalizeOptionalString(body.mobile);
  if ("dateOfBirth" in body) {
    const dob = normalizeOptionalString(body.dateOfBirth);
    if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      return badRequest("Date of birth must be YYYY-MM-DD.");
    }
    data.dateOfBirth = dob;
  }
  if ("gender" in body) {
    const gender = normalizeOptionalString(body.gender);
    if (gender && !(GENDER_OPTIONS as readonly string[]).includes(gender)) {
      return badRequest("Invalid gender option.");
    }
    data.gender = gender;
  }
  if ("emergencyContactName" in body) {
    data.emergencyContactName = normalizeOptionalString(body.emergencyContactName);
  }
  if ("emergencyContactPhone" in body) {
    data.emergencyContactPhone = normalizeOptionalString(body.emergencyContactPhone);
  }

  const user = await prisma.user.update({
    where: { id: session.sub },
    data,
    select: profileSelect,
  });
  return NextResponse.json(user);
}
