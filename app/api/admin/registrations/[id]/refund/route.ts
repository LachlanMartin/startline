import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { getStripe } from "@/lib/stripe";
import { writeAuditLog } from "@/lib/audit";
import { idParams } from "@/lib/schemas";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  try {
    const registration = await prisma.registration.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        amountCents: true,
        stripePaymentIntentId: true,
        athleteName: true,
      },
    });

    if (!registration) {
      return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    }

    if (registration.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "Only confirmed registrations can be refunded." },
        { status: 409 },
      );
    }

    // Free or external registration — just flip the status
    if (!registration.stripePaymentIntentId) {
      await prisma.registration.update({ where: { id }, data: { status: "REFUNDED" } });
      writeAuditLog({
        adminId: session.sub,
        action: "REFUND_REGISTRATION",
        targetType: "registration",
        targetId: id,
        meta: { method: "free", athleteName: registration.athleteName },
      });
      return NextResponse.json({ ok: true, method: "free" });
    }

    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.retrieve(
      registration.stripePaymentIntentId,
    );

    const chargeId =
      typeof paymentIntent.latest_charge === "string"
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge?.id;

    if (!chargeId) {
      return NextResponse.json(
        { error: "No charge found on this payment intent." },
        { status: 422 },
      );
    }

    const refund = await stripe.refunds.create({ charge: chargeId });

    await prisma.registration.update({ where: { id }, data: { status: "REFUNDED" } });

    writeAuditLog({
      adminId: session.sub,
      action: "REFUND_REGISTRATION",
      targetType: "registration",
      targetId: id,
      meta: {
        stripeRefundId: refund.id,
        amountCents: registration.amountCents,
        athleteName: registration.athleteName,
      },
    });

    return NextResponse.json({ ok: true, refundId: refund.id });
  } catch (err) {
    console.error("Admin refund error:", err);
    return NextResponse.json({ error: "Refund failed." }, { status: 503 });
  }
}
