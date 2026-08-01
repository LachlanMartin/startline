import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { sendEventApprovedEmail, sendEventRejectedEmail } from "@/lib/email";
import { writeAuditLog } from "@/lib/audit";
import { notifyOrganiserFollowers } from "@/lib/notify-organiser-followers";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { action?: string; reason?: string };
  const { action, reason } = body;

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'." }, { status: 400 });
  }

  if (action === "reject" && !reason?.trim()) {
    return NextResponse.json({ error: "A rejection reason is required." }, { status: 400 });
  }

  try {
    const event = await prisma.event.findUnique({
      where:  { id },
      select: {
        id: true, title: true, status: true, registrationType: true,
        eventDate: true, city: true,
        organiser: { select: { id: true, email: true, orgName: true, stripeOnboardingComplete: true } },
      },
    });

    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

    if (event.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only PENDING events can be reviewed." },
        { status: 409 },
      );
    }

    // Per ToS §3.4 — marketplace listings cannot go live until Stripe onboarding is complete
    if (action === "approve" && event.registrationType === "startline") {
      if (!event.organiser.stripeOnboardingComplete) {
        return NextResponse.json(
          { error: "This organiser has not completed Stripe Express onboarding. Marketplace events cannot be approved until their payout account is verified (ToS §3.4).", code: "STRIPE_NOT_ONBOARDED" },
          { status: 422 },
        );
      }
    }

    const newStatus = action === "approve" ? "APPROVED" : "REJECTED";

    const organiserEmail = event.organiser.email;
    const organiserId    = event.organiser.id;

    const notifData = action === "approve"
      ? {
          type:  "EVENT_APPROVED" as const,
          title: "Event approved",
          body:  `Your event "${event.title}" has been approved and is now live on Startline.`,
        }
      : {
          type:  "EVENT_REJECTED" as const,
          title: "Event not approved",
          body:  `Your event "${event.title}" was not approved. Reason: ${reason?.trim() ?? "No reason provided."}`,
        };

    await prisma.$transaction([
      prisma.event.update({
        where: { id },
        data: {
          status:          newStatus,
          reviewedById:    session.sub,
          reviewedAt:      new Date(),
          rejectionReason: action === "reject" ? reason!.trim() : null,
        },
      }),
      prisma.notification.create({
        data: { organiserId, eventId: id, ...notifData },
      }),
    ]);

    if (action === "approve") {
      sendEventApprovedEmail(organiserEmail, event.title).catch((err) =>
        console.error("Failed to send approval email:", err),
      );
      notifyOrganiserFollowers({
        organiserId,
        eventId: id,
        eventTitle: event.title,
        organiserName: event.organiser.orgName,
        eventDate: event.eventDate || null,
        city: event.city || null,
      }).catch((err) => console.error("Follower notify failed:", err));
    } else {
      sendEventRejectedEmail(organiserEmail, event.title, reason?.trim()).catch((err) =>
        console.error("Failed to send rejection email:", err),
      );
    }

    writeAuditLog({
      adminId: session.sub,
      action: action === "approve" ? "APPROVE_EVENT" : "REJECT_EVENT",
      targetType: "event",
      targetId: id,
      meta: { title: event.title, reason: reason?.trim() ?? null },
    });

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (err) {
    console.error("Admin review error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
