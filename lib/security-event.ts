import prisma from "@/lib/prisma";

/**
 * Record an admin-visible security incident (failed bot check, review report,
 * etc.). Best-effort: a DB failure never blocks the request path.
 */
export async function recordSecurityEvent(params: {
  type: string;
  action?: string;
  key?: string;
  ip?: string;
  userId?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await prisma.securityEvent.create({
      data: {
        type:   params.type,
        action: params.action,
        key:    params.key,
        ip:     params.ip,
        userId: params.userId,
        meta:   params.meta as any,
      },
    });
  } catch (err) {
    console.error("SecurityEvent write failed:", err);
  }
}
