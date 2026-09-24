// Sends a large-order alert email via Web3Forms from the browser.
// The access key is public by design, so it's safe in frontend code.
export async function sendLargeOrderEmail(order, user, address) {
  const key = import.meta.env.VITE_WEB3FORMS_KEY;

  if (!key) {
    console.warn("VITE_WEB3FORMS_KEY is not set; skipping email.");
    return;
  }

  const message =
    `A large order needs approval.\n\n` +
    `Order: ${order.orderNumber}\n` +
    `Total: ₦${Number(order.pricing.total).toLocaleString("en-NG")}\n` +
    `Customer: ${user?.displayName || user?.email || ""} (${address?.phone || ""})\n\n` +
    `Open the admin dashboard to approve or reject it.`;

  try {
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_key: key,
        subject: `Large order needs approval — ${order.orderNumber}`,
        from_name: "VhitePizza",
        message,
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