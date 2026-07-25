const SITE = process.env.SITE_URL ?? 'https://startlineau.com'

export const handler = async (event) => {
  const { triggerSource, request } = event
  const code = request.codeParameter
  if (!code) return event

  const isReset = triggerSource === 'CustomMessage_ForgotPassword'
  event.response = {
    emailSubject: isReset ? 'Reset your Startline password' : `${code} is your Startline verification code`,
    emailMessage: isReset ? buildPasswordResetHtml(code) : buildOtpHtml(code),
  }
  return event
}

function buildOtpHtml(code) {
  const tiles = code.split('').map(d => `
    <td style="padding:0 4px;">
      <div style="width:58px;height:74px;line-height:74px;background:#2A2A2A;border:1.5px solid #B3E153;border-radius:12px;font-family:'Chakra Petch',Arial,sans-serif;font-size:34px;font-weight:700;color:#B3E153;text-align:center;">
        ${d}
      </div>
    </td>`).join('')

  return shell(`
    ${header()}
    <div style="padding:44px;text-align:center;">
      ${badge('security')}
      <h1 style="font-family:'Chakra Petch',Arial,sans-serif;font-size:32px;font-weight:700;font-style:italic;letter-spacing:-0.025em;line-height:1.08;color:#F5F7FA;margin:16px 0 12px;">
        Verify your<br><span style="color:#B3E153;">email address.</span>
      </h1>
      <p style="font-family:'Inter',Arial,sans-serif;font-size:15px;color:#8A8F98;line-height:1.65;margin:0 0 32px;">
        Enter the code below to confirm your Startline account. It expires in 10 minutes.
      </p>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 auto 32px;">
        <tr>${tiles}</tr>
      </table>
      <div style="text-align:left;">
        ${noteBox('shield', "Didn't request this?", "If you didn't create a Startline account, you can safely ignore this email. No action is required.")}
      </div>
    </div>
    ${footer()}
  `)
}

function buildPasswordResetHtml(code) {
  const tiles = code.split('').map(d => `
    <td style="padding:0 4px;">
      <div style="width:58px;height:74px;line-height:74px;background:#2A2A2A;border:1.5px solid #B3E153;border-radius:12px;font-family:'Chakra Petch',Arial,sans-serif;font-size:34px;font-weight:700;color:#B3E153;text-align:center;">
        ${d}
      </div>
    </td>`).join('')

  return shell(`
    ${header()}
    <div style="padding:44px;text-align:center;">
      ${badge('security')}
      <h1 style="font-family:'Chakra Petch',Arial,sans-serif;font-size:32px;font-weight:700;font-style:italic;letter-spacing:-0.025em;line-height:1.08;color:#F5F7FA;margin:16px 0 12px;">
        Reset your<br><span style="color:#B3E153;">password.</span>
      </h1>
      <p style="font-family:'Inter',Arial,sans-serif;font-size:15px;color:#8A8F98;line-height:1.65;margin:0 0 24px;">
        Enter the code below on the password reset page to set a new password for your Startline account.
      </p>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 auto 28px;">
        <tr>${tiles}</tr>
      </table>
      <a href="${SITE}/auth/forgot-password" style="display:inline-block;background:linear-gradient(135deg,#C2EC77 0%,#B3E153 55%,#A4D62F 100%);color:#141414;font-family:'Chakra Petch',Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;padding:13px 30px;border-radius:12px;box-shadow:3px 3px 0 rgba(90,140,0,0.6);text-decoration:none;">
        Reset Password
      </a>
      <div style="margin-top:24px;text-align:left;">
        ${noteBox('alert', 'This code expires in 24 hours', 'For security, the password reset code is only valid for a limited time. Request a new one if it has expired.')}
      </div>
      <div style="margin-top:12px;text-align:left;">
        ${noteBox('shield', "Didn't request this?", `If you didn't request a password reset, you can safely ignore this email. Your password will not change.`)}
      </div>
    </div>
    ${footer()}
  `)
}

function shell(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="color-scheme" content="dark">
  <style>@import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:ital,wght@0,700;1,700&family=Inter:wght@400;500&display=swap');</style>
</head>
<body style="background:#141414;margin:0;padding:40px 0;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">
        <table style="max-width:600px;width:100%;background:#1F1F1F;border:1px solid #303030;border-radius:16px;" cellpadding="0" cellspacing="0">
          <tr><td>${content}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function header() {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #303030;">
    <tr>
      <td style="padding:26px 44px 22px;">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-right:10px;vertical-align:middle;">
              <img src="${SITE}/email/logo-mark.svg" width="22" height="22" alt="" style="display:block;">
            </td>
            <td style="vertical-align:middle;">
              <img src="${SITE}/email/logo-title.svg" height="13" alt="Startline" style="display:block;">
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`
}

function footer() {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #303030;">
    <tr>
      <td style="padding:28px 44px 26px;text-align:center;">
        <p style="margin:0 0 10px;font-family:'Chakra Petch',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#6E737B;">
          <a href="https://www.instagram.com/startlineau" style="color:#6E737B;text-decoration:none;">Instagram</a>
          &nbsp;|&nbsp;
          <a href="https://www.facebook.com/startlineau" style="color:#6E737B;text-decoration:none;">Facebook</a>
          &nbsp;|&nbsp;
          <a href="https://www.strava.com/clubs/startlineau" style="color:#6E737B;text-decoration:none;">Strava</a>
        </p>
        <p style="margin:0 0 6px;font-family:'Inter',Arial,sans-serif;font-size:12px;color:#8A8F98;">
          Need help? <a href="mailto:support@startline.com.au" style="color:#8A8F98;">support@startline.com.au</a>
        </p>
        <p style="margin:0 0 16px;font-family:'Inter',Arial,sans-serif;font-size:11px;color:#6E737B;">
          <a href="#" style="color:#6E737B;text-decoration:none;">Unsubscribe</a> &middot; <a href="#" style="color:#6E737B;text-decoration:none;">Manage Preferences</a>
        </p>
        <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:11px;color:#6E737B;line-height:1.7;">
          &copy; 2026 Startline Pty Ltd &middot; ABN 12 345 678 901<br>
          PO Box 1234, Sydney NSW 2000, Australia
        </p>
        <p style="margin:4px 0 0;font-family:'Inter',Arial,sans-serif;font-size:10px;color:#6E737B;">
          This is a transactional email. You cannot unsubscribe from account and event notifications.
        </p>
      </td>
    </tr>
  </table>`
}

function badge(type) {
  const cfg = {
    security: { bg: 'rgba(179,225,83,0.08)', border: 'rgba(179,225,83,0.15)', color: '#B3E153', label: 'ACCOUNT SECURITY' },
  }[type]
  return `
  <table cellpadding="0" cellspacing="0" style="display:inline-table;background:${cfg.bg};border:1px solid ${cfg.border};border-radius:100px;">
    <tr>
      <td style="padding:5px 0 5px 10px;vertical-align:middle;line-height:1;">
        <div style="width:6px;height:6px;border-radius:50%;background:${cfg.color};"></div>
      </td>
      <td style="padding:5px 14px 5px 7px;vertical-align:middle;font-family:'Chakra Petch',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${cfg.color};white-space:nowrap;line-height:1;">
        ${cfg.label}
      </td>
    </tr>
  </table>`
}

function noteBox(icon, title, body) {
  const icons = { shield: 'shield.svg', alert: 'alert.svg', clock: 'clock.svg' }
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#252525;border:1px solid #303030;border-radius:10px;">
    <tr>
      <td style="padding:15px 0 15px 20px;vertical-align:top;width:32px;">
        <img src="${SITE}/email/icons/${icons[icon]}" width="16" height="16" alt="" style="display:block;margin-top:2px;">
      </td>
      <td style="padding:15px 20px 15px 8px;vertical-align:top;">
        <p style="margin:0 0 4px;font-family:'Chakra Petch',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#F5F7FA;">${title}</p>
        <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:13px;color:#8A8F98;line-height:1.65;">${body}</p>
      </td>
    </tr>
  </table>`
}
