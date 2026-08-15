import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { z } from "zod";

const VALID_STATUSES = ["CONFIRMED", "REFUND_REQUESTED", "CANCELLED", "REFUNDED"] as const;
type RegStatus = (typeof VALID_STATUSES)[number];

const registrationsQuery = z.object({
  status: z.enum(VALID_STATUSES).optional().catch(undefined),
  eventId: z.string().max(255).optional().catch(undefined),
  search: z.string().max(200).catch(""),
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(50),
});

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = registrationsQuery.parse(Object.fromEntries(searchParams));
  const status  = query.status;
  const eventId = query.eventId;
  const search  = query.search;
  const page    = query.page;
  const limit   = query.limit;
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
