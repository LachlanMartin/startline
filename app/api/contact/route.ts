import { NextResponse } from "next/server";
import { Resend } from "resend";

const ADMIN_EMAIL = "admin@startlineau.com";
const DEFAULT_FROM = "Startline <events@startlineau.com>";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function POST(request: Request) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return NextResponse.json(
      { error: "Email service is not configured yet. Please try again shortly." },
      { status: 500 }
    );
  }

  const resend = new Resend(resendApiKey);
  const from = process.env.RESEND_FROM?.trim() || DEFAULT_FROM;

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
  } | null;

  const name = body?.name?.trim() ?? "";
  const email = body?.email?.trim() ?? "";
  const subject = body?.subject?.trim() ?? "";
  const message = body?.message?.trim() ?? "";

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: "Please fill out all fields." }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: ADMIN_EMAIL,
      replyTo: email,
      subject: `[Contact] ${subject}`,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="margin:0;padding:32px;background:#141414;font-family:Inter,system-ui,sans-serif;color:#F5F7FA;">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#1D1D1D;border:1px solid #2A2A2A;border-radius:12px;">
              <tr>
                <td style="padding:28px;">
                  <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:#B3E153;">New Contact Form Message</h1>
                  <p style="margin:0 0 10px;font-size:14px;color:#8A8F98;">Name</p>
                  <p style="margin:0 0 16px;font-size:16px;color:#F5F7FA;">${escapeHtml(name)}</p>
                  <p style="margin:0 0 10px;font-size:14px;color:#8A8F98;">Email</p>
                  <p style="margin:0 0 16px;font-size:16px;color:#F5F7FA;">${escapeHtml(email)}</p>
                  <p style="margin:0 0 10px;font-size:14px;color:#8A8F98;">Subject</p>
                  <p style="margin:0 0 16px;font-size:16px;color:#F5F7FA;">${escapeHtml(subject)}</p>
                  <p style="margin:0 0 10px;font-size:14px;color:#8A8F98;">Message</p>
                  <p style="margin:0;font-size:16px;line-height:1.6;color:#F5F7FA;white-space:pre-wrap;">${escapeHtml(message)}</p>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("Contact email Resend error:", error);
      return NextResponse.json(
        { error: "Could not send your message right now. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: data?.id ?? null });
  } catch (error) {
    console.error("Contact email send error:", error);
    return NextResponse.json(
      { error: "Could not send your message right now. Please try again." },
      { status: 500 }
    );
  }
}
