import { Resend } from "resend";
import { render } from "@react-email/render";
import { RegistrationConfirmationEmail } from "@/emails/registration-confirmation";

const getResend = () => {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
};

const FROM = "Startline <events@startlineau.com>";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function getEmailFrom(): string {
  return process.env.RESEND_FROM ?? FROM;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Registration Confirmation ─────────────────────────────────────────────────
export interface RegistrationEmailData {
  eventName: string;
  eventSeries?: string;
  eventDate: string;
  startTime: string;
  category: string;
  location: string;
  bib?: string;
  registrationFee: string;
  serviceFee: string;
  total: string;
  userEmail: string;
}

export async function sendRegistrationConfirmationEmail(to: string, data: RegistrationEmailData) {
  const resend = getResend();
  if (!resend) return;
  const html = await render(RegistrationConfirmationEmail(data));
  await resend.emails.send({
    from: FROM,
    to,
    subject: `You're registered for ${data.eventName}`,
    html,
  });
}

// ── Guest Registration Verification ───────────────────────────────────────────
export type GuestRegistrationVerificationDetails = {
  email: string;
  code: string;
  eventTitle: string;
  idempotencyKey: string;
};

export function buildGuestRegistrationVerificationEmail(details: GuestRegistrationVerificationDetails) {
  return {
    subject: `Your Startline verification code: ${details.code}`,
    html: `
      <!DOCTYPE html>
      <html>
        <body style="margin:0;padding:32px;background:#141414;font-family:Inter,system-ui,sans-serif;color:#F5F7FA;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#1D1D1D;border:1px solid #2A2A2A;border-radius:12px;">
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#B3E153;">Verify your email</p>
                <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;color:#F5F7FA;">Enter this code to continue registration</h1>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#8A8F98;">
                  Use this code to confirm your email address for <strong style="color:#F5F7FA;">${escapeHtml(details.eventTitle)}</strong>.
                  It expires in 15 minutes.
                </p>
                <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8A8F98;">Verification code</p>
                <p style="margin:0 0 24px;font-size:36px;line-height:1;font-weight:800;letter-spacing:0.35em;color:#B3E153;font-family:monospace;">${escapeHtml(details.code)}</p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#8A8F98;">
                  If you did not start an event registration, you can ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  };
}

export async function sendGuestRegistrationVerificationEmail(details: GuestRegistrationVerificationDetails) {
  const resend = getResend();
  if (!resend) {
    console.warn("RESEND_API_KEY not configured — skipping guest verification email");
    return;
  }
  const { subject, html } = buildGuestRegistrationVerificationEmail(details);
  const result = await resend.emails.send(
    { from: getEmailFrom(), to: details.email, subject, html },
    { idempotencyKey: `guest-registration-verify-${details.idempotencyKey}` },
  );
  if (result.error) throw new Error(`Resend error: ${result.error.message}`);
}

// ── Event approved ────────────────────────────────────────────────────────────
export async function sendEventApprovedEmail(email: string, eventTitle: string) {
  const resend = getResend();
  if (!resend) return;
  await resend.emails.send({
    from: getEmailFrom(),
    to: email,
    subject: `Your event "${eventTitle}" is now live`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#B3E153">Event approved!</h2>
        <p>Your event <strong>${eventTitle}</strong> has been approved and is now live on Startline.</p>
        <a href="${SITE}/organiser/dashboard" style="display:inline-block;margin:16px 0;background:#B3E153;color:#141414;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none">
          View dashboard
        </a>
      </div>
    `,
  });
}

// ── Wave update (athlete) ─────────────────────────────────────────────────────
export interface WaveUpdateEmailData {
  athleteName?: string | null;
  eventTitle: string;
  eventId: string;
  waveLabel: string;
  waveTime?: string | null; // start time for the wave, if known
  eventDate?: string | null;
}

export async function sendWaveUpdateEmail(to: string, data: WaveUpdateEmailData) {
  const resend = getResend();
  if (!resend) return;
  const greeting = data.athleteName ? `Hi ${escapeHtml(data.athleteName.split(" ")[0])},` : "Hi,";
  const when = [data.eventDate, data.waveTime].filter(Boolean).join(" · ");
  await resend.emails.send({
    from: getEmailFrom(),
    to,
    subject: `Your start wave for ${data.eventTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#141414">
        <p style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#7AA820">Start wave update</p>
        <h2 style="margin:4px 0 12px">You're in the ${escapeHtml(data.waveLabel)} wave</h2>
        <p style="font-size:15px;line-height:1.6">${greeting}</p>
        <p style="font-size:15px;line-height:1.6">
          Your start wave for <strong>${escapeHtml(data.eventTitle)}</strong> is
          <strong>${escapeHtml(data.waveLabel)}</strong>${when ? `, ${escapeHtml(when)}` : ""}.
        </p>
        <p style="font-size:14px;line-height:1.6;color:#555">
          Please arrive in good time for your wave. If anything changes, we'll let you know.
        </p>
        <a href="${SITE}/activity" style="display:inline-block;margin:16px 0;background:#B3E153;color:#141414;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none">
          View your registration
        </a>
      </div>
    `,
  });
}

// ── Followed organiser event live ─────────────────────────────────────────────
export interface FollowedOrganiserEventEmailData {
  followerName?: string | null;
  organiserName: string;
  eventTitle: string;
  eventId: string;
  eventDate?: string | null;
  city?: string | null;
}

export async function sendFollowedOrganiserEventEmail(
  to: string,
  data: FollowedOrganiserEventEmailData,
) {
  const resend = getResend();
  if (!resend) return;
  const greeting = data.followerName
    ? `Hi ${escapeHtml(data.followerName.split(" ")[0])},`
    : "Hi,";
  const meta = [data.eventDate, data.city].filter(Boolean).join(" · ");
  await resend.emails.send({
    from: getEmailFrom(),
    to,
    subject: `${data.organiserName} posted ${data.eventTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#141414">
        <p style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#7AA820">New event</p>
        <h2 style="margin:4px 0 12px">${escapeHtml(data.organiserName)} just went live</h2>
        <p style="font-size:15px;line-height:1.6">${greeting}</p>
        <p style="font-size:15px;line-height:1.6">
          <strong>${escapeHtml(data.organiserName)}</strong> posted
          <strong>${escapeHtml(data.eventTitle)}</strong>${meta ? ` — ${escapeHtml(meta)}` : ""}.
        </p>
        <a href="${SITE}/events/${encodeURIComponent(data.eventId)}" style="display:inline-block;margin:16px 0;background:#B3E153;color:#141414;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none">
          View event
        </a>
      </div>
    `,
  });
}

// ── Event rejected ────────────────────────────────────────────────────────────
export async function sendEventRejectedEmail(email: string, eventTitle: string, reason?: string) {
  const resend = getResend();
  if (!resend) return;
  await resend.emails.send({
    from: getEmailFrom(),
    to: email,
    subject: `Update on your event "${eventTitle}"`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#141414">Event update</h2>
        <p>Your event <strong>${eventTitle}</strong> was not approved.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
        <p>Please log into your dashboard to make the required changes and resubmit.</p>
        <a href="${SITE}/organiser/dashboard" style="display:inline-block;margin:16px 0;background:#B3E153;color:#141414;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none">
          Go to dashboard
        </a>
      </div>
    `,
  });
}
