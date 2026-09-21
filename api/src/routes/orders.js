const express = require("express");
const { verifyToken, requireRole } = require("../middleware/auth");
const { schemas, parse } = require("../validators/order");
const { HttpError } = require("../utils/errors");
const {
  createOrder,
  markPaid,
  changeStatus,
  assignRider,
  claimOrder,
  markRefundDone,
  listMine,
  getOrder,
  setPaymentReference,
} = require("../services/orders");
const {
  initializeTransaction,
  verifyTransaction,
  CURRENCY,
} = require("../services/payments/paystack");

const router = express.Router();

router.use(verifyToken);

const roleOf = (req) => req.user.role || "customer";

// Customer: create an order (it starts as awaiting_payment).
router.post("/", async (req, res) => {
  const body = parse(schemas.order, req.body);

  const order = await createOrder({
    user: req.user,
    items: body.items,
    address: body.address,
  });

  res.status(201).json({ success: true, data: order });
});

// Customer: initialize Paystack payment for an awaiting-payment order.
router.post("/:id/payment/initialize", async (req, res) => {
  const order = await getOrder(req.params.id, {
    ...req.user,
    role: roleOf(req),
  });

  if (order.customerId !== req.user.uid) {
    throw new HttpError(403, "This is not your order.");
  }

  if (order.status !== "awaiting_payment") {
    throw new HttpError(409, "This order is not awaiting payment.");
  }

  const reference = `VP-${order.id}-${Date.now()}`;
  const callbackUrl =
    process.env.PAYSTACK_CALLBACK_URL ||
    `${process.env.WEB_URL || "http://localhost:5173"}/payment/return`;

  const payment = await initializeTransaction({
    email: order.customer?.email || req.user.email,
    amountNaira: order.pricing.total,
    reference,
    callbackUrl,
    metadata: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: req.user.uid,
    },
  });

  await setPaymentReference(order.id, payment.reference || reference);

  res.json({
    success: true,
    data: {
      authorizationUrl: payment.authorization_url,
      reference: payment.reference || reference,
      accessCode: payment.access_code,
      currency: CURRENCY,
    },
  });
});

// Customer: verify a Paystack payment after returning from Paystack.
router.post("/:id/payment/verify", async (req, res) => {
  const order = await getOrder(req.params.id, {
    ...req.user,
    role: roleOf(req),
  });

  if (order.customerId !== req.user.uid) {
    throw new HttpError(403, "This is not your order.");
  }

  const reference = String(req.body?.reference || "").trim();

  if (!reference) {
    throw new HttpError(400, "Payment reference is required.");
  }

if (order.payment?.reference !== reference) {
  throw new HttpError(
    403,
    "Payment reference does not belong to this order."
  );
}
  const payment = await verifyTransaction(reference);

  if (payment.status !== "success") {
    throw new HttpError(402, "Paystack payment was not successful.");
  }

  if (payment.reference !== reference) {
    throw new HttpError(400, "Payment reference does not match.");
  }

  if (payment.currency !== CURRENCY) {
    throw new HttpError(400, "Payment currency does not match.");
  }

  const expectedAmount = Number(order.pricing?.total || 0) * 100;

  if (Number(payment.amount) !== expectedAmount) {
    throw new HttpError(400, "Payment amount does not match the order.");
  }

  const result = await markPaid(order.id, reference);

  res.json({
    success: true,
    data: {
      ...result,
      reference,
      paymentStatus: "paid",
    },
  });
});

// Customer: my recent orders.
router.get("/mine", async (req, res) => {
  res.json({ success: true, data: await listMine(req.user.uid) });
});

router.get("/:id", async (req, res) => {
  res.json({
    success: true,
    data: await getOrder(req.params.id, {
      ...req.user,
      role: roleOf(req),
    }),
  });
});

// Customer: cancel while the order has not started preparing.
router.post("/:id/cancel", async (req, res) => {
  const { reason } = parse(schemas.reason, req.body);

  const result = await changeStatus(
    req.params.id,
    "cancelled",
    { uid: req.user.uid, role: "customer" },
    reason
  );

  res.json({ success: true, data: result });
});

// Staff: move an order to the next status.
router.patch(
  "/:id/status",
  requireRole("admin", "kitchen", "rider"),
  async (req, res) => {
    const { status, reason } = parse(schemas.status, req.body);

    const result = await changeStatus(
      req.params.id,
      status,
      { uid: req.user.uid, role: roleOf(req) },
      reason
    );

    res.json({ success: true, data: result });
  }
);

// Admin: approve or reject a large order.
router.post("/:id/approve", requireRole("admin"), async (req, res) => {
  const result = await changeStatus(req.params.id, "confirmed", {
    uid: req.user.uid,
    role: "admin",
  });

  res.json({ success: true, data: result });
});

router.post("/:id/reject", requireRole("admin"), async (req, res) => {
  const { reason } = parse(schemas.reason, req.body);

  const result = await changeStatus(
    req.params.id,
    "cancelled",
    { uid: req.user.uid, role: "admin" },
    reason
  );

  res.json({ success: true, data: result });
});

router.post("/:id/assign-rider", requireRole("admin"), async (req, res) => {
  const { riderId } = parse(schemas.rider, req.body);

  res.json({
    success: true,
    data: await assignRider(req.params.id, riderId),
  });
});

router.post("/:id/claim", requireRole("rider"), async (req, res) => {
  res.json({
    success: true,
    data: await claimOrder(req.params.id, req.user.uid),
  });
});

router.post("/:id/refund-done", requireRole("admin"), async (req, res) => {
  res.json({
    success: true,
    data: await markRefundDone(req.params.id),
  });
});

// Testing only.
if (process.env.ALLOW_DEV_PAY === "true") {
  router.post("/:id/dev-pay", async (req, res) => {
    await getOrder(req.params.id, {
      ...req.user,
      role: roleOf(req),
    });

    res.json({
      success: true,
      data: await markPaid(req.params.id, "dev-test"),
    });
  });
}

// Anything not matched above.
router.use((req, res, next) => next(new HttpError(404, "Not found.")));

module.exports = router;