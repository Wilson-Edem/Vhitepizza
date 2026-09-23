// Sends an email through Web3Forms. Used for large-order alerts.
async function sendEmail({ subject, message }) {
  const key = process.env.WEB3FORMS_KEY;

  if (!key) {
    console.warn("WEB3FORMS_KEY is not set; skipping email:", subject);
    return;
  }

  try {
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Origin: "https://vhitepizza.web.app",
        Referer: "https://vhitepizza.web.app/",
      },
      body: JSON.stringify({
        access_key: key,
        subject,
        message,
        from_name: "Vhite Pizza",
        botcheck: false,
      }),
    });

    const text = await response.text();

    // Log the raw response when something looks wrong.
    if (!response.ok || text.trim().startsWith("<")) {
      console.error(
        "Web3Forms email failed:",
        response.status,
        text.slice(0, 300)
      );
      return;
    }

    console.log("Web3Forms email sent:", subject);
  } catch (error) {
    console.error("Web3Forms email failed:", error.message);
  }
}

async function sendLargeOrderEmail(order) {
  await sendEmail({
    subject: `Large order needs approval — ${order.orderNumber}`,
    message:
      `A large order needs your confirmation.\n\n` +
      `Order: ${order.orderNumber}\n` +
      `Total: ₦${Number(order.pricing.total).toLocaleString("en-NG")}\n` +
      `Customer: ${order.customer?.name || ""} (${order.customer?.phone || ""})\n\n` +
      `Open the admin dashboard to approve or reject it.`,
  });
}

module.exports = { sendEmail, sendLargeOrderEmail };