const { db } = require("../config/firebase");
const { sendBrevoEmail } = require("./brevo");

async function sendEmail({ subject, message }) {
  // Kept for the existing large-order alert flow.
  const key = process.env.WEB3FORMS_KEY;

  if (!key) {
    console.warn("WEB3FORMS_KEY is not set; skipping Web3Forms email:", subject);
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
        from_name: "Vhitepizza",
        botcheck: false,
      }),
    });

    const responseText = await response.text();

    if (!response.ok || responseText.trim().startsWith("<")) {
      console.error(
        "Web3Forms email failed:",
        response.status,
        responseText.slice(0, 300)
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
      `Total: ₦${Number(order.pricing?.total || 0).toLocaleString("en-NG")}\n` +
      `Customer: ${order.customer?.name || ""} (${order.customer?.phone || ""})\n\n` +
      `Open the admin dashboard to approve or reject it.`,
  });
}

const EMAIL_MOMENTS = new Set([
  "confirmed",
  "ready",
  "out_for_delivery",
  "delivered",
]);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function momentCopy(moment) {
  return {
    confirmed: {
      subject: "Your Vhitepizza order is confirmed",
      title: "Order confirmed",
      intro: "Your order has been confirmed and is now moving into preparation.",
    },
    ready: {
      subject: "Your Vhitepizza order is ready",
      title: "Your order is ready",
      intro: "Your order is ready for delivery.",
    },
    out_for_delivery: {
  subject: "Your Vhitepizza order is on the way",
  title: "Out for delivery",
  intro: "Your order has left the kitchen and is on its way to you.",
},
    delivered: {
      subject: "Your Vhitepizza order has been delivered",
      title: "Order delivered",
      intro: "Your Vhitepizza order has been marked as delivered. Enjoy your meal!",
    },
  }[moment];
}

function orderItemsHtml(order) {
  return (order.items || [])
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;">
            ${escapeHtml(item.quantity)} × ${escapeHtml(item.name)}
            ${
              item.sizeLabel
                ? `<div style="font-size:12px;color:#777;">${escapeHtml(item.sizeLabel)}</div>`
                : ""
            }
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">
            ₦${Number(item.lineTotal || 0).toLocaleString("en-NG")}
          </td>
        </tr>
      `
    )
    .join("");
}

function buildOrderEmail(order, moment) {
  const copy = momentCopy(moment);
  const customerName = order.customer?.name || "Customer";
  const orderNumber = order.orderNumber || order.id;
  const total = Number(order.pricing?.total || 0).toLocaleString("en-NG");
  const address = order.address?.formattedAddress || "Delivery address on your order";
  const items = orderItemsHtml(order);

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#171717;">
      <div style="background:#111;padding:24px;border-radius:14px 14px 0 0;">
        <h1 style="margin:0;color:#ff5e00;font-size:26px;">Vhitepizza</h1>
      </div>
      <div style="padding:28px;border:1px solid #eee;border-top:0;border-radius:0 0 14px 14px;">
        <p style="font-size:14px;color:#666;margin:0 0 8px;">Hi ${escapeHtml(customerName)},</p>
        <h2 style="margin:0 0 10px;">${escapeHtml(copy.title)}</h2>
        <p style="line-height:1.6;">${escapeHtml(copy.intro)}</p>

        <div style="background:#f7f7f7;border-radius:10px;padding:16px;margin:22px 0;">
          <strong>Order ${escapeHtml(orderNumber)}</strong>
          <div style="margin-top:8px;color:#555;">Delivery: ${escapeHtml(address)}</div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin:18px 0;">
          ${items}
          <tr>
            <td style="padding:12px 0;font-weight:bold;">Total</td>
            <td style="padding:12px 0;text-align:right;font-weight:bold;">₦${total}</td>
          </tr>
        </table>

        <p style="font-size:13px;color:#777;margin-top:24px;">
          This is an automated Vhitepizza order update. Please keep this email for your records.
        </p>
      </div>
    </div>
  `;

  const textContent =
    `Hi ${customerName},\n\n` +
    `${copy.title}\n${copy.intro}\n\n` +
    `Order: ${orderNumber}\n` +
    `Delivery: ${address}\n\n` +
    `${(order.items || [])
      .map(
        (item) =>
          `${item.quantity} x ${item.name} — ₦${Number(
            item.lineTotal || 0
          ).toLocaleString("en-NG")}`
      )
      .join("\n")}\n\n` +
    `Total: ₦${total}\n\n` +
    `— Vhitepizza`;

  return { subject: copy.subject, htmlContent, textContent };
}

async function sendOrderEmail(order, moment) {
  if (!EMAIL_MOMENTS.has(moment)) return { skipped: true };

  const email = order.customer?.email;
  if (!email) {
    console.warn(
      `No customer email for ${order.orderNumber || order.id}; skipping ${moment} email.`
    );
    return { skipped: true };
  }

  try {
    const content = buildOrderEmail(order, moment);
    const result = await sendBrevoEmail({
      to: [{ email, name: order.customer?.name || undefined }],
      ...content,
    });

    console.log(
      `Brevo ${moment} email sent for ${order.orderNumber || order.id}.`
    );
    return result;
  } catch (error) {
    // Email failure must never undo an already-completed order status change.
    console.error(
      `Brevo ${moment} email failed for ${order.orderNumber || order.id}:`,
      error.message
    );
    return { failed: true, error: error.message };
  }
}

async function notifyOrderStatus(orderId, moment) {
  if (!db || !EMAIL_MOMENTS.has(moment)) return { skipped: true };

  const snap = await db.collection("orders").doc(orderId).get();
  if (!snap.exists) return { skipped: true };

  return sendOrderEmail({ id: snap.id, ...snap.data() }, moment);
}

module.exports = {
  sendEmail,
  sendLargeOrderEmail,
  sendOrderEmail,
  notifyOrderStatus,
};
