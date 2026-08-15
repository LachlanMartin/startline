import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { z } from "zod";

const usersQuery = z.object({
  search: z.string().max(200).catch(""),
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(50),
});

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const { search, page, limit } = usersQuery.parse(Object.fromEntries(searchParams));
  const skip = (page - 1) * limit;

  const where = search
    ? {
        OR: [
          { email:    { contains: search, mode: "insensitive" as const } },
          { name:     { contains: search, mode: "insensitive" as const } },
          { username: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  try {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          isPublic: true,
          isBanned: true,
          city: true,
          state: true,
          createdAt: true,
          memberships: { select: { organiser: { select: { id: true, orgName: true, status: true } } } },
          _count: { select: { registrations: true } },
        },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({ users, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("Admin users fetch error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
