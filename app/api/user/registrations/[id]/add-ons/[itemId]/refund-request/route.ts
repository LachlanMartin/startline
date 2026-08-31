import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { idItemIdParams } from "@/lib/schemas";
import {
  addOnRefundAmountCents,
  canRequestAddOnRefund,
} from "@/lib/add-on-refunds";
import { addOnStockLabel } from "@/lib/add-ons";
import { z } from "zod";

const bodySchema = z.object({ reason: z.string().max(1000).optional() });

/**
 * POST — the athlete asks for one purchased add-on back.
 *
 * Separate from the entry refund request by design: no policy tiers, no
 * percentage, and no effect on the registration. The organiser decides.
 * Ownership is the same check the entry route uses, on the same registration.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsedParams = idItemIdParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id, itemId } = parsedParams.data;

  const parsedBody = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const item = await prisma.registrationAddOn.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      registrationId: true,
      status: true,
      amountCents: true,
      platformFeeCents: true,
      feeStructure: true,
      nameSnapshot: true,
      variantLabelSnapshot: true,
      quantity: true,
      registration: {
        select: {
          id: true,
          userId: true,
          athleteEmail: true,
          athleteName: true,
          event: {
            select: { id: true, title: true, eventDate: true, organiserId: true },
          },
        },
      },
    },
  });

  // Scope strictly to the caller's own entry, by user link or matching email,
  // and to the registration named in the path so an item id alone reveals
  // nothing.
  const isOwner =
    !!item &&
    item.registrationId === id &&
    (item.registration.userId === session.sub ||
      item.registration.athleteEmail.toLowerCase() === session.email.toLowerCase());
  if (!item || !isOwner) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const allowed = canRequestAddOnRefund({
    item,
    eventDate: item.registration.event.eventDate,
    today,
  });
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.reason }, { status: allowed.status });
  }

  // Frozen at request time so the figure quoted to the athlete is the figure the
  // organiser later approves, exactly as entry refunds work.
  const refundAmountCents = addOnRefundAmountCents(item);

  await prisma.registrationAddOn.update({
    where: { id: itemId },
    data: {
      status: "REFUND_REQUESTED",
      refundRequestedAt: new Date(),
      refundReason: parsedBody.data.reason?.trim() || null,
      refundAmountCents,
      // A previous decline is history now that a fresh request is open.
      refundDeclinedAt: null,
      refundDeclineReason: null,
    },
  });

  const label = addOnStockLabel(item.nameSnapshot, item.variantLabelSnapshot);

  // Tell everyone who can act on it. Best-effort: the request is recorded, and a
  // notification failure must not make the athlete think it was not.
  await prisma.notification
    .create({
      data: {
        organiserId: item.registration.event.organiserId,
        eventId: item.registration.event.id,
        type: "NEW_REGISTRATION",
        title: "Add-on refund requested",
        body:
          `${item.registration.athleteName} asked to return ${item.quantity} x ${label} ` +
          `for ${item.registration.event.title}. ` +
          `Approve or decline it in the event's add-ons tab.`,
      },
    })
    .catch((err: unknown) => console.error("Failed to notify organiser of add-on refund:", err));

  return NextResponse.json({
    status: "REFUND_REQUESTED",
    refundAmountCents,
  });
}
