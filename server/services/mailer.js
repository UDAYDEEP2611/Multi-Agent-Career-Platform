const nodemailer = require("nodemailer");

// Sends account emails (verification, password reset).
// With SMTP_HOST set, mail goes out over SMTP:
//   SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS, MAIL_FROM
// Without it, the email is printed to the server console so links can be
// used in development. In tests, mail is collected in `outbox` instead.

const outbox = [];
let transporter = null;

function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 587;

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined
    });
  }

  return transporter;
}

async function sendMail({ to, replyTo, subject, text, html }) {
  if (process.env.NODE_ENV === "test") {
    outbox.push({ to, replyTo, subject, text, html });
    return;
  }

  if (!process.env.SMTP_HOST) {
    console.log(
      `\n----- Email (SMTP_HOST not set, not sent) -----\nTo: ${to}\nSubject: ${subject}\n\n${text}\n-----------------------------------------------\n`
    );
    return;
  }

  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    replyTo,
    subject,
    text,
    html
  });
}

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

// A short email with one button; text is the plain-text fallback
function buttonEmail({ greeting, intro, buttonLabel, link, outro }) {
  const text = `${greeting}\n\n${intro}\n\n${link}\n\n${outro}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1f2937">
      <h2 style="color:#2563eb">UltraUnityVerse</h2>
      <p>${escapeHtml(greeting)}</p>
      <p>${escapeHtml(intro)}</p>
      <p style="margin:28px 0">
        <a href="${escapeHtml(link)}" style="background:#2563eb;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none">${escapeHtml(buttonLabel)}</a>
      </p>
      <p style="font-size:13px;color:#6b7280">If the button doesn't work, copy this link into your browser:<br>${escapeHtml(link)}</p>
      <p style="font-size:13px;color:#6b7280">${escapeHtml(outro)}</p>
    </div>`;

  return { text, html };
}

module.exports = { sendMail, buttonEmail, outbox };
