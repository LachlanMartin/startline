import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";

const ADMIN_EMAIL = "admin@startlineau.com";

const feedbackSchema = z.object({
  type: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  details: z.string().min(1).max(5000),
  email: z.string().max(255).optional(),
  filenames: z.array(z.string().max(255)).optional(),
});

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function POST(request: NextRequest) {
  const blocked = await rateLimit(request, { prefix: "feedback", limit: 3, windowSeconds: 60 });
  if (blocked) return blocked;

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return NextResponse.json(
      { error: "Email service is not configured." },
      { status: 500 }
    );
  }

  const parsed = feedbackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const type      = parsed.data.type.trim();
  const title     = parsed.data.title.trim();
  const details   = parsed.data.details.trim();
  const email     = (parsed.data.email ?? "").trim();
  const filenames = parsed.data.filenames ?? [];

  if (!type || !title || !details) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const ref = "SL-" + String(Math.floor(1000 + Math.random() * 9000));

  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#6E737B;">${label}</td>
    </tr>
    <tr>
      <td style="padding:0 0 20px;font-size:15px;color:#F5F7FA;white-space:pre-wrap;">${value}</td>
    </tr>`;

  const optionalRows = [
    email     ? row("From",        escapeHtml(email))                   : "",
    filenames.length ? row("Attachments", escapeHtml(filenames.join(", "))) : "",
  ].join("");

  const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:32px;background:#141414;font-family:Inter,system-ui,sans-serif;color:#F5F7FA;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#1D1D1D;border:1px solid #2A2A2A;border-radius:12px;">
      <tr>
        <td style="padding:28px 32px 8px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;color:#B3E153;">Startline Feedback</p>
          <h1 style="margin:0 0 4px;font-size:24px;font-weight:700;color:#F5F7FA;">${escapeHtml(title)}</h1>
          <p style="margin:0 0 28px;font-size:12px;color:#6E737B;">Ref ${ref}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${row("Type",    escapeHtml(type))}
            ${row("Details", escapeHtml(details))}
            ${optionalRows}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const replyTo = email || undefined;
  const resend = new Resend(resendApiKey);

  const { data, error } = await resend.emails.send({
    from:    "Startline <noreply@startlineau.com>",
    to:      ADMIN_EMAIL,
    replyTo,
    subject: `[${escapeHtml(type)}] ${escapeHtml(title)} — ${ref}`,
    html,
  });

  if (error) {
    console.error("Resend error:", error);
    return NextResponse.json(
      { error: "Could not send your report right now. Please try again." },
      { status: 500 }
    );
  }

  console.log("Feedback email sent, Resend id:", data?.id);
  return NextResponse.json({ ref });
}
