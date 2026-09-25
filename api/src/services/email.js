const { db } = require("../config/firebase");
const { sendBrevoEmail } = require("./brevo");

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

// ---------- Admin: large-order alert ----------

const naira = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;

function buildLargeOrderEmail(order) {
  const itemsHtml = (order.items || [])
    .map(
      (item) => `
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#222;">
            <strong>${escapeHtml(item.quantity)}× ${escapeHtml(item.name)}</strong>
            ${item.sizeLabel ? `<span style="color:#888;"> (${escapeHtml(item.sizeLabel)})</span>` : ""}
            ${
              item.details?.length
                ? `<div style="font-size:12px;color:#777;margin-top:2px;">${escapeHtml(item.details.join(" · "))}</div>`
                : ""
            }
          </td>
        </tr>`
    )
    .join("");

  const mapsLink =
    Number.isFinite(order.address?.lat) && Number.isFinite(order.address?.lng)
      ? `https://www.google.com/maps?q=${order.address.lat},${order.address.lng}`
      : null;

  const htmlContent = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:20px;background:#0f0f10;color:#f5f5f5;border-radius:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h2 style="margin:0;font-size:20px;color:#fff;">${escapeHtml(order.orderNumber)}</h2>
        <span style="background:#3a1a1a;color:#ff6b6b;padding:4px 10px;border-radius:20px;font-size:11px;letter-spacing:0.5px;">
          ⚠ LARGE ORDER
        </span>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
        ${itemsHtml}
      </table>

      <div style="font-size:20px;font-weight:bold;color:#ff8c42;margin:14px 0;padding-top:10px;border-top:1px solid #2a2a2c;">
        ${naira(order.pricing?.total)}
      </div>

      <div style="margin-bottom:10px;font-size:14px;color:#ddd;">
        <strong style="color:#fff;">${escapeHtml(order.customer?.name || "Customer")}</strong>
        ${
          order.customer?.phone
            ? ` · <a href="tel:${escapeHtml(order.customer.phone)}" style="color:#ff8c42;text-decoration:none;">${escapeHtml(order.customer.phone)}</a>`
            : ""
        }
      </div>

      <div style="font-size:13px;color:#aaa;line-height:1.5;margin-bottom:10px;">
        ${escapeHtml(order.address?.formattedAddress || "")}
        ${order.address?.landmark ? `<br>Near ${escapeHtml(order.address.landmark)}` : ""}
      </div>

      ${
        mapsLink
          ? `<a href="${mapsLink}" style="display:inline-block;color:#ff8c42;font-size:13px;text-decoration:none;margin-bottom:14px;">📍 Open in Maps</a>`
          : ""
      }

      <div style="margin-top:16px;">
        <a href="https://vhitepizza.web.app/staff/admin" style="display:inline-block;background:#ff6b35;color:#fff;padding:10px 18px;border-radius:8px;font-size:14px;text-decoration:none;font-weight:bold;">
          Open Staff Dashboard
        </a>
      </div>
    </div>
  `;

  const textContent =
    `Large order needs approval — ${order.orderNumber}\n\n` +
    `Total: ${naira(order.pricing?.total)}\n` +
    `Customer: ${order.customer?.name || ""} (${order.customer?.phone || ""})\n\n` +
    `Open the admin dashboard to approve or reject it.`;

  return { subject: `Large order needs approval — ${order.orderNumber}`, htmlContent, textContent };
}

async function sendLargeOrderEmail(order) {
  const to = process.env.ADMIN_ALERT_EMAIL || process.env.BREVO_SENDER_EMAIL;

  if (!to) {
    console.warn("ADMIN_ALERT_EMAIL / BREVO_SENDER_EMAIL not set; skipping large-order alert.");
    return { skipped: true };
  }

  try {
    const content = buildLargeOrderEmail(order);
    const result = await sendBrevoEmail({ to: [{ email: to }], ...content });
    console.log(`Brevo large-order alert sent for ${order.orderNumber}.`);
    return result;
  } catch (error) {
    console.error(`Brevo large-order alert failed for ${order.orderNumber}:`, error.message);
    return { failed: true, error: error.message };
  }
}

// ---------- Customer: status update emails ----------

const EMAIL_MOMENTS = new Set(["confirmed", "ready", "out_for_delivery", "delivered"]);

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
          <td style="padding:6px 0;font-size:14px;color:#222;">
            ${escapeHtml(item.quantity)} × ${escapeHtml(item.name)}
            ${item.sizeLabel ? `<span style="color:#888;"> (${escapeHtml(item.sizeLabel)})</span>` : ""}
          </td>
          <td style="padding:6px 0;text-align:right;color:#222;">
            ₦${Number(item.lineTotal || 0).toLocaleString("en-NG")}
          </td>
        </tr>`
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
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:20px;background:#fff;color:#222;border-radius:12px;">
      <h1 style="color:#ff6b35;font-size:22px;margin:0 0 20px;">Vhitepizza</h1>
      <p>Hi ${escapeHtml(customerName)},</p>
      <h2 style="font-size:18px;">${escapeHtml(copy.title)}</h2>
      <p>${escapeHtml(copy.intro)}</p>
      <p><strong>Order ${escapeHtml(orderNumber)}</strong></p>
      <p>Delivery: ${escapeHtml(address)}</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        ${items}
      </table>
      <p style="font-size:16px;"><strong>Total: ₦${total}</strong></p>
      <p style="font-size:12px;color:#888;margin-top:20px;">This is an automated Vhitepizza order update.</p>
    </div>
  `;

  const textContent =
    `Hi ${customerName},\n\n` +
    `${copy.title}\n${copy.intro}\n\n` +
    `Order: ${orderNumber}\n` +
    `Delivery: ${address}\n\n` +
    (order.items || [])
      .map((item) => `${item.quantity} x ${item.name} — ₦${Number(item.lineTotal || 0).toLocaleString("en-NG")}`)
      .join("\n") +
    `\n\nTotal: ₦${total}\n\n— Vhitepizza`;

  return { subject: copy.subject, htmlContent, textContent };
}

async function sendOrderEmail(order, moment) {
  if (!EMAIL_MOMENTS.has(moment)) return { skipped: true };

  const email = order.customer?.email;

  if (!email) {
    console.warn(`No customer email for ${order.orderNumber || order.id}; skipping ${moment} email.`);
    return { skipped: true };
  }

  try {
    const content = buildOrderEmail(order, moment);
    const result = await sendBrevoEmail({
      to: [{ email, name: order.customer?.name || undefined }],
      ...content,
    });
    console.log(`Brevo ${moment} email sent for ${order.orderNumber || order.id}.`);
    return result;
  } catch (error) {
    console.error(`Brevo ${moment} email failed for ${order.orderNumber || order.id}:`, error.message);
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
  sendLargeOrderEmail,
  sendOrderEmail,
  notifyOrderStatus,
};
