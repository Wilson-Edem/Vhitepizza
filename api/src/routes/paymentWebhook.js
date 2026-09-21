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

// Paystack settlement source of truth.
// The browser return URL never marks an order as paid.
router.post("/webhook", async (req, res) => {
  const signature = req.headers["x-paystack-signature"];

  if (!verifyWebhookSignature(req.rawBody, signature)) {
    return res.status(401).json({
      success: false,
      message: "Invalid webhook signature.",
    });
  }

  const event = req.body || {};
  const reference = String(event.data?.reference || "").trim();

  if (event.event !== "charge.success" || !reference) {
    return res.json({ success: true, received: true });
  }

  const orderId = await findOrderIdByPaymentReference(reference);

  if (!orderId) {
    throw new HttpError(404, "No order matches this payment reference.");
  }

  const order = await getOrder(orderId, {
    uid: "__paystack_webhook__",
    role: "admin",
  });

  const metadataOrderId =
    metadataValue(event.data?.metadata, "orderId") ||
    metadataValue(event.data?.metadata, "order_id");

  if (metadataOrderId && metadataOrderId !== orderId) {
    throw new HttpError(409, "Payment metadata does not match the order.");
  }

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
