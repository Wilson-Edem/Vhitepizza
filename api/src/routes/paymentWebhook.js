const express = require("express");
const {
  verifyWebhookSignature,
  verifyTransaction,
} = require("../services/payments/paystack");
const {
  findOrderIdByPaymentReference,
  markPaid,
  getOrder,
} = require("../services/orders");
const { HttpError } = require("../utils/errors");

const router = express.Router();

function metadataValue(metadata, key) {
  if (!metadata) return null;

  if (typeof metadata === "object") return metadata[key] || null;

  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata);
      return parsed?.[key] || null;
    } catch {
      return null;
    }
  }

  return null;
}

// Public Paystack webhook. Do not put verifyToken on this route.
router.post("/webhook", async (req, res) => {
  const signature = req.headers["x-paystack-signature"];
  const rawBody = req.rawBody;

  if (!verifyWebhookSignature(rawBody, signature)) {
    return res.status(401).json({
      success: false,
      message: "Invalid webhook signature.",
    });
  }

  const event = req.body || {};
  const reference = String(event.data?.reference || "").trim();

  // Only successful charges can advance an order. Other events are safely
  // acknowledged so Paystack does not repeatedly resend them.
  if (event.event !== "charge.success" || !reference) {
    return res.json({ success: true, received: true });
  }

  const orderId =
    metadataValue(event.data?.metadata, "orderId") ||
    metadataValue(event.data?.metadata, "order_id") ||
    (await findOrderIdByPaymentReference(reference));

  if (!orderId) {
    throw new HttpError(404, "No order matches this payment reference.");
  }

  // The order service is the source of truth. Admin access here is only used
  // so the webhook can read the order without a customer Firebase token.
  const order = await getOrder(orderId, {
    uid: "__paystack_webhook__",
    role: "admin",
  });

  const transaction = await verifyTransaction(reference);

  const expectedAmount = Number(order.pricing?.total || 0) * 100;

  if (
    transaction.status !== "success" ||
    transaction.reference !== reference ||
    transaction.currency !== "NGN" ||
    Number(transaction.amount || 0) !== expectedAmount
  ) {
    throw new HttpError(409, "Webhook payment does not match the order.");
  }

  const result = await markPaid(orderId, reference);

  return res.json({
    success: true,
    received: true,
    fulfilled: true,
    data: result,
  });
});

module.exports = router;
