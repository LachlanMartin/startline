import { Ratelimit } from "@upstash/ratelimit";
import type { Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

const configured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);

const redis = configured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

const limiters = new Map<string, Ratelimit>();

function getLimiter(prefix: string, limit: number, window: Duration): Ratelimit | null {
  if (!redis) return null;
  const key = `${prefix}:${limit}:${window}`;
  let rl = limiters.get(key);
  if (!rl) {
    rl = new Ratelimit({
      redis,
      prefix: `ratelimit:${prefix}`,
      limiter: Ratelimit.fixedWindow(limit, window),
    });
    limiters.set(key, rl);
  }
  return rl;
}

export type RateLimitOptions = {
  /** Namespaces the Redis keys, e.g. "verify-email-send". */
  prefix: string;
  limit: number;
  window: Duration;
  /** Overrides the default IP key. Use user/email id once authenticated. */
  identifier?: string;
};

/**
 * Fixed-window rate limit keyed by client IP by default. Returns a 429
 * response with Retry-After + X-RateLimit-* headers when blocked, or null to
 * let the request through. Returns null when Upstash is not configured so
 * local dev and tests are unaffected.
 */
export async function rateLimit(
  req: NextRequest,
  opts: RateLimitOptions,
): Promise<NextResponse | null> {
  const rl = getLimiter(opts.prefix, opts.limit, opts.window);
  if (!rl) return null;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success, limit, remaining, reset } = await rl.limit(opts.identifier ?? ip);
  if (success) return null;

  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": String(remaining),
        "X-RateLimit-Reset": String(reset),
      },
    },
  );
}
