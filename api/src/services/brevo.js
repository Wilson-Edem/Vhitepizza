const { HttpError } = require("../utils/errors");

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

async function sendBrevoEmail({ to, subject, htmlContent, textContent }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn("BREVO_API_KEY is not set; skipping Brevo email:", subject);
    return { skipped: true };
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "Vhitepizza";

  if (!senderEmail) {
    console.warn("BREVO_SENDER_EMAIL is not set; skipping Brevo email:", subject);
    return { skipped: true };
  }

  const recipients = Array.isArray(to) ? to : [to];
  const cleanRecipients = recipients
    .filter((recipient) => recipient?.email)
    .map((recipient) => ({
      email: recipient.email,
      ...(recipient.name ? { name: recipient.name } : {}),
    }));

  if (!cleanRecipients.length) {
    return { skipped: true };
  }

  const response = await fetch(BREVO_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: cleanRecipients,
      subject,
      htmlContent,
      ...(textContent ? { textContent } : {}),
    }),
  });

  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.message ||
      raw?.slice(0, 300) ||
      `Brevo returned HTTP ${response.status}.`;
    throw new HttpError(502, `Brevo email failed: ${message}`);
  }

  return data || { ok: true };
}

module.exports = { sendBrevoEmail };
