import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export type RateLimitOptions = {
  /** Namespaces the keys, e.g. "verify-email-send". */
  prefix: string;
  limit: number;
  windowSeconds: number;
  /** Overrides the default IP key. Use user/email id once authenticated. */
  identifier?: string;
};

type Row = { count: number; resetAt: Date };

/**
 * Fixed-window rate limit keyed by client IP by default. Returns a 429
 * response with Retry-After + X-RateLimit-* headers when blocked, or null to
 * let the request through. Fail-open: a DB error lets the request through.
 */
export async function rateLimit(
  req: NextRequest,
  opts: RateLimitOptions,
): Promise<NextResponse | null> {
  const key = `${opts.prefix}:${opts.identifier ?? ipOf(req)}`;

  let row: Row;
  try {
    const rows = await prisma.$queryRaw<Row[]>`
      INSERT INTO "rate_limits" ("key", "count", "resetAt")
      VALUES (${key}, 1, now() + make_interval(secs => ${opts.windowSeconds}))
      ON CONFLICT ("key") DO UPDATE
      SET "count" = CASE
            WHEN "rate_limits"."resetAt" <= now() THEN 1
            ELSE "rate_limits"."count" + 1
          END,
          "resetAt" = CASE
            WHEN "rate_limits"."resetAt" <= now()
              THEN now() + make_interval(secs => ${opts.windowSeconds})
            ELSE "rate_limits"."resetAt"
          END
      RETURNING "count", "resetAt"
    `;
    row = rows[0];
  } catch {
    // Fail-open: limiter unavailable, let the request through.
    return null;
  }

  if (row.count <= opts.limit) return null;

  const retryAfter = Math.max(1, Math.ceil((row.resetAt.getTime() - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(opts.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(row.resetAt.getTime()),
      },
    },
  );
}

function ipOf(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
