const nodemailer = require("nodemailer");

let cachedTransporter = null;

function buildTransporter() {
  // Prefer explicit SMTP (production-friendly)
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : null;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && port && user && pass) {
    const secure = port === 465;
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  // Fallback to Gmail (existing OTP flow uses these)
  if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    });
  }

  throw new Error("No mail credentials configured (set SMTP_* or GMAIL_*)");
}

function getTransporter() {
  if (!cachedTransporter) cachedTransporter = buildTransporter();
  return cachedTransporter;
}

exports.sendMail = async function sendMail({ to, subject, text, html }) {
  const transporter = getTransporter();
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || process.env.GMAIL_USER;
  const info = await transporter.sendMail({ from, to, subject, text, html });
  return info;
};
