import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";

const VALID_STATUSES = ["CONFIRMED", "REFUND_REQUESTED", "CANCELLED", "REFUNDED"] as const;
type RegStatus = (typeof VALID_STATUSES)[number];

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status")?.toUpperCase();
  const status: RegStatus | undefined =
    (VALID_STATUSES as readonly string[]).includes(statusParam ?? "")
      ? (statusParam as RegStatus)
      : undefined;

  const eventId = searchParams.get("eventId") ?? undefined;
  const search  = searchParams.get("search") ?? "";
  const page    = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
  const limit   = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
  const skip    = (page - 1) * limit;

  const where = {
    ...(status   ? { status }   : {}),
    ...(eventId  ? { eventId }  : {}),
    ...(search   ? {
      OR: [
        { athleteName:  { contains: search, mode: "insensitive" as const } },
        { athleteEmail: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  try {
    const [registrations, total] = await Promise.all([
      prisma.registration.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          athleteName: true,
          athleteEmail: true,
          category: true,
          waveLabel: true,
          amountCents: true,
          platformFeeCents: true,
          feeStructure: true,
          status: true,
          stripePaymentIntentId: true,
          createdAt: true,
          event:     { select: { id: true, title: true, eventDate: true, city: true, state: true } },
          organiser: { select: { id: true, orgName: true, contactName: true, email: true } },
        },
        skip,
        take: limit,
      }),
      prisma.registration.count({ where }),
    ]);

    return NextResponse.json({ registrations, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("Admin registrations fetch error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
