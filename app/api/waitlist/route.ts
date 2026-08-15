import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { WaitlistConfirmationEmail } from "@/emails/waitlist-confirmation";
import { z } from "zod";

const waitlistSchema = z.object({ email: z.string().max(255) });

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Missing RESEND_API_KEY environment variable.");
  return new Resend(key);
}

export async function POST(req: NextRequest) {
  const parsed = waitlistSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }
  const { email } = parsed.data;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  try {
    await prisma.waitlistSubscriber.create({ data: { email } });
  } catch (e) {
    if ((e as Record<string, unknown>).code === "P2002") {
      return NextResponse.json({ error: "You're already on the waitlist!" }, { status: 409 });
    }
    console.error("DB error:", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  try {
    const html = await render(WaitlistConfirmationEmail());
    const result = await getResend().emails.send({
      from:    "Startline <waitlist@startlineau.com>",
      to:      email,
      subject: "You're on the Startline waitlist",
      html,
    });
    if (result.error) {
      console.error("Resend error:", result.error);
    } else {
      console.log("Email sent successfully, id:", result.data?.id);
    }
  } catch (emailError) {
    console.error("Email send failed:", emailError);
  }

  return NextResponse.json({ success: true });
}
