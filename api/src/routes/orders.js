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
} = require("../services/orders");

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

// Customer: my recent orders.
router.get("/mine", async (req, res) => {
  res.json({ success: true, data: await listMine(req.user.uid) });
});

router.get("/:id", async (req, res) => {
  res.json({
    success: true,
    data: await getOrder(req.params.id, { ...req.user, role: roleOf(req) }),
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

// Staff: move an order to the next status (checked against the rules).
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

  res.json({ success: true, data: await assignRider(req.params.id, riderId) });
});

router.post("/:id/claim", requireRole("rider"), async (req, res) => {
  res.json({
    success: true,
    data: await claimOrder(req.params.id, req.user.uid),
  });
});

router.post("/:id/refund-done", requireRole("admin"), async (req, res) => {
  res.json({ success: true, data: await markRefundDone(req.params.id) });
});

// Testing only: pretends the payment succeeded. It stays switched off unless
// ALLOW_DEV_PAY=true is set in api/.env. Never set it on the live server.
if (process.env.ALLOW_DEV_PAY === "true") {
  router.post("/:id/dev-pay", async (req, res) => {
    await getOrder(req.params.id, { ...req.user, role: roleOf(req) });

    res.json({ success: true, data: await markPaid(req.params.id, "dev-test") });
  });
}

// Anything not matched above.
router.use((req, res, next) => next(new HttpError(404, "Not found.")));

module.exports = router;
