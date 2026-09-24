// Sends a large-order alert email via Web3Forms from the browser.
// The access key is public by design, so it's safe in frontend code.
export async function sendLargeOrderEmail(order, user, address) {
  const key = import.meta.env.VITE_WEB3FORMS_KEY;

  if (!key) {
    console.warn("VITE_WEB3FORMS_KEY is not set; skipping email.");
    return;
  }

  const naira = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;

  const itemsHtml = (order.items || [])
    .map((item) => {
      const extras = [];
      if (item.crustName) extras.push(item.crustName);
      if (item.cheeseName) extras.push(item.cheeseName);
      if (Array.isArray(item.details) && item.details.length) {
        extras.push(...item.details);
      }

      return `
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#222;">
            <strong>${item.quantity}× ${item.name}</strong>
            ${item.sizeLabel ? `<span style="color:#888;"> (${item.sizeLabel})</span>` : ""}
            ${
              extras.length
                ? `<div style="font-size:12px;color:#777;margin-top:2px;">${extras.join(" · ")}</div>`
                : ""
            }
          </td>
        </tr>`;
    })
    .join("");

  const mapsLink =
    Number.isFinite(order.address?.lat) && Number.isFinite(order.address?.lng)
      ? `https://www.google.com/maps?q=${order.address.lat},${order.address.lng}`
      : null;

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:20px;background:#0f0f10;color:#f5f5f5;border-radius:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h2 style="margin:0;font-size:20px;color:#fff;">${order.orderNumber}</h2>
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
        <strong style="color:#fff;">${order.customer?.name || "Customer"}</strong>
        ${order.customer?.phone ? ` · <a href="tel:${order.customer.phone}" style="color:#ff8c42;text-decoration:none;">${order.customer.phone}</a>` : ""}
      </div>

      <div style="font-size:13px;color:#aaa;line-height:1.5;margin-bottom:10px;">
        ${order.address?.formattedAddress || ""}
        ${order.address?.landmark ? `<br>Near ${order.address.landmark}` : ""}
      </div>

      ${
        mapsLink
          ? `<a href="${mapsLink}" style="display:inline-block;color:#ff8c42;font-size:13px;text-decoration:none;margin-bottom:14px;">📍 Open in Maps</a>`
          : ""
      }

      <div style="margin-top:16px;">
        <a href="https://vhitepizza.web.app/staff" style="display:inline-block;background:#ff6b35;color:#fff;padding:10px 18px;border-radius:8px;font-size:14px;text-decoration:none;font-weight:bold;">
          Open Staff Dashboard
        </a>
      </div>
    </div>
  `;

  try {
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_key: key,
        subject: `Large order needs approval — ${order.orderNumber}`,
        from_name: "Vhite Pizza",
        message: html,
      }),
    });

    const text = await response.text();

    if (!response.ok || text.trim().startsWith("<")) {
      console.error(
        "Web3Forms email failed:",
        response.status,
        text.slice(0, 300)
      );
      return;
    }

    console.log("Web3Forms email sent:", order.orderNumber);
  } catch (error) {
    console.error("Web3Forms email failed:", error.message);
  }
}