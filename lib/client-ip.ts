import { NextRequest } from "next/server";

/** Best-effort client IP. Behind Cloudflare the CF-Connecting-IP header is set. */
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
