import { NextResponse } from "next/server";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function POST() {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  try {
    const stripe = getStripe();

    const organiser = await prisma.organiser.findUnique({
      where:  { id: session.sub },
      select: { stripeAccountId: true, email: true },
    });

    if (!organiser) return NextResponse.json({ error: "Organiser not found." }, { status: 404 });

    let accountId = organiser.stripeAccountId;

    // Create a new Express account if one doesn't exist yet
    if (!accountId) {
      const account = await stripe.accounts.create({
        type:    "express",
        country: "AU",
        email:   organiser.email,
        capabilities: {
          card_payments: { requested: true },
          transfers:     { requested: true },
        },
        business_type: "individual",
        settings: {
          payouts: {
            schedule: { interval: "manual" },
          },
        },
      });

      accountId = account.id;

      await prisma.organiser.update({
        where: { id: session.sub },
        data:  { stripeAccountId: accountId },
      });
    }

    // Generate a fresh Account Link for the hosted onboarding flow
    const accountLink = await stripe.accountLinks.create({
      account:     accountId,
      refresh_url: `${SITE}/organiser/payments?refresh=1`,
      return_url:  `${SITE}/organiser/payments/return`,
      type:        "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err) {
    console.error("Stripe connect error:", err);
    return NextResponse.json({ error: "Failed to create Stripe onboarding link." }, { status: 503 });
  }
}
