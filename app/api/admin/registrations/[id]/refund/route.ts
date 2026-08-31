import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { getStripe } from "@/lib/stripe";
import { writeAuditLog } from "@/lib/audit";
import { idParams } from "@/lib/schemas";
import {
  buildRefundParams,
  entryRefundAmountCents,
  isOutsidePolicyRefund,
} from "@/lib/stripe-refunds";

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
        platformFeeCents: true,
        refundAmountCents: true,
        refundPercent: true,
        stripePaymentIntentId: true,
        athleteName: true,
        userId: true,
        event: { select: { id: true, title: true } },
      },
    });

    if (!registration) {
      return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    }

    if (registration.status !== "CONFIRMED" && registration.status !== "REFUND_REQUESTED") {
      return NextResponse.json(
        { error: "Only confirmed or refund-requested registrations can be refunded." },
        { status: 409 },
      );
    }

    // Tell the athlete their refund went through. Best-effort in every case: the
    // status change is what matters, so a notification failure must never turn a
    // successful refund into an error.
    const notifyAthlete = async (cents: number) => {
      if (!registration.userId) return;
      try {
        await prisma.userNotification.create({
          data: {
            userId: registration.userId,
            type: "REFUND_PROCESSED",
            title: "Refund processed",
            body:
              cents > 0
                ? `Your refund of $${(cents / 100).toFixed(2)} for ${registration.event.title} is on its way ` +
                  `back to your original payment method. Allow 5 to 10 business days.`
                : `Your entry to ${registration.event.title} has been cancelled and released.`,
            eventId: registration.event.id,
          },
        });
      } catch {
        // Swallowed on purpose — see above.
      }
    };

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
      await notifyAthlete(0);
      return NextResponse.json({ ok: true, method: "free" });
    }

    // Honour the snapshot taken when the athlete asked, clamped to what THIS
    // entry paid. That means the entry ALONE: add-on money lives on
    // RegistrationAddOn rows and is refunded separately, so this keeps its
    // original meaning now that merchandise exists.
    //
    // The amount is always explicit. An amountless refund returns the entire
    // charge, and one PaymentIntent covers every participant in a group booking,
    // so that would refund the whole family (and their merchandise) over one
    // athlete's request.
    const refundCents = entryRefundAmountCents(registration);

    // Checked before touching Stripe so a refused request costs nothing.
    if (isOutsidePolicyRefund(registration)) {
      return NextResponse.json(
        { error: "This request is outside the event's refund policy. Refund a different amount manually in Stripe if it is being granted as a goodwill exception." },
        { status: 409 },
      );
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

    const refund = await stripe.refunds.create(
      ...buildRefundParams({
        chargeId,
        amountCents: refundCents,
        // Retrying a failed request must not refund the athlete twice.
        idempotencyKey: `entry-refund-${registration.id}`,
      }),
    );

    await prisma.registration.update({ where: { id }, data: { status: "REFUNDED" } });

    await notifyAthlete(refundCents);

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
