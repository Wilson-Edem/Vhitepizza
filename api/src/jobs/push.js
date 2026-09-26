const { db } = require("../config/firebase");
const { sendToRoles } = require("../services/push");

const INTERVAL_MS = 20 * 1000;
const ACTIVE_STATUSES = ["placed", "pending_approval", "confirmed", "preparing", "ready", "out_for_delivery"];
const STAFF_ROLES = ["admin", "kitchen", "rider"];

function toMs(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function payloadForNewOrder(order) {
  return {
    type: "new_order",
    title: `New order ${order.orderNumber || ""}`.trim(),
    body: `${order.customer?.name || "Customer"} placed an order for ₦${Number(order.pricing?.total || 0).toLocaleString("en-NG")}.`,
    url: "/staff/admin",
    tag: `new-order-${order.id}`,
    orderId: order.id,
  };
}

function payloadForApproval(order) {
  return {
    type: "large_order",
    title: `Large order ${order.orderNumber || ""}`.trim(),
    body: `Order ${order.orderNumber || order.id} needs admin approval.`,
    url: "/staff/admin",
    tag: `large-order-${order.id}`,
    orderId: order.id,
  };
}

function payloadForLate(order) {
  return {
    type: "running_late",
    title: `Order ${order.orderNumber || ""} is running late`.trim(),
    body: `The requested delivery target has passed. Prioritize this order.`,
    url: "/staff/admin",
    tag: `running-late-${order.id}`,
    orderId: order.id,
  };
}

async function markAlert(orderRef, field) {
  await orderRef.update({ [field]: new Date() });
}

async function checkPushAlerts() {
  if (!db) return;

  const snap = await db.collection("orders").where("status", "in", ACTIVE_STATUSES).get();
  const now = Date.now();

  for (const doc of snap.docs) {
    const order = doc.data();
    const ref = doc.ref;

    if (!order.pushAlerts?.newOrderSentAt && ["placed", "pending_approval", "confirmed", "preparing", "ready", "out_for_delivery"].includes(order.status)) {
      const result = await sendToRoles(STAFF_ROLES, payloadForNewOrder({ id: doc.id, ...order }));
      if (!result.skipped && result.sent > 0 && result.failed === 0) await markAlert(ref, "pushAlerts.newOrderSentAt");
    }

    if (order.status === "pending_approval" && !order.pushAlerts?.largeApprovalSentAt) {
      const result = await sendToRoles(["admin"], payloadForApproval({ id: doc.id, ...order }));
      if (!result.skipped && result.sent > 0 && result.failed === 0) await markAlert(ref, "pushAlerts.largeApprovalSentAt");
    }

    const targetAt = toMs(order.requestedByAt);
    if (
      targetAt !== null &&
      targetAt <= now &&
      !order.pushAlerts?.runningLateSentAt &&
      !["delivered", "cancelled"].includes(order.status)
    ) {
      const result = await sendToRoles(["admin", "kitchen"], payloadForLate({ id: doc.id, ...order }));
      if (!result.skipped && result.sent > 0 && result.failed === 0) await markAlert(ref, "pushAlerts.runningLateSentAt");
    }
  }
}

function startPushJobs() {
  if (!db) {
    console.warn("Push alert jobs are off because the database is not ready.");
    return;
  }

  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await checkPushAlerts();
    } catch (error) {
      console.error("Push alert job failed:", error.message);
    } finally {
      running = false;
    }
  }, INTERVAL_MS);

  timer.unref?.();
}

module.exports = { startPushJobs, checkPushAlerts };
