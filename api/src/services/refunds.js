const { db, FieldValue } = require("../config/firebase");
const { HttpError } = require("../utils/errors");
const { createRefund } = require("./payments/paystack");

function requireDb() {
  if (!db) throw new HttpError(503, "Database is not available.");
}

async function initiateRefund(orderId, adminUid) {
  requireDb();

  const ref = db.collection("orders").doc(orderId);
  const snap = await ref.get();

  if (!snap.exists) throw new HttpError(404, "Order not found.");

  const order = snap.data();
  const payment = order.payment || {};

  if (payment.status === "refunded") {
    return { id: orderId, payment: "refunded", alreadyRefunded: true };
  }

  if (payment.status !== "refund_pending") {
    throw new HttpError(409, "No refund is pending for this order.");
  }

  if (payment.refundReference) {
    return {
      id: orderId,
      payment: "refund_pending",
      refundReference: payment.refundReference,
      alreadyInitiated: true,
    };
  }

  const transaction = String(payment.reference || "").trim();
  if (!transaction || transaction === "dev-test") {
    throw new HttpError(409, "This order does not have a refundable Paystack transaction.");
  }

  const total = Number(order.pricing?.total || 0);
  if (!Number.isInteger(total) || total <= 0) {
    throw new HttpError(409, "The order does not have a valid refund amount.");
  }

  const refund = await createRefund({
    transaction,
    amountNaira: total,
    customerNote: `Vhitepizza refund for ${order.orderNumber || orderId}`,
    merchantNote: `Refund initiated by admin ${adminUid || "unknown"}`,
  });

  const refundReference =
    refund?.reference || refund?.id || refund?.refund_reference || null;

  await ref.update({
    "payment.status": "refund_pending",
    "payment.refundReference": refundReference,
    "payment.refundInitiatedAt": FieldValue.serverTimestamp(),
    "payment.refundInitiatedBy": adminUid || null,
    "payment.refundError": FieldValue.delete(),
  });

  return {
    id: orderId,
    payment: "refund_pending",
    refundReference,
  };
}

async function recordRefundEvent(event) {
  requireDb();

  const reference = String(event?.data?.transaction_reference || event?.data?.transaction || "").trim();
  if (!reference) return { ignored: true, reason: "missing_transaction_reference" };

  const snapshot = await db
    .collection("orders")
    .where("payment.reference", "==", reference)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return { ignored: true, reason: "order_not_found", reference };
  }

  const ref = snapshot.docs[0].ref;
  const orderId = snapshot.docs[0].id;
  const eventName = String(event?.event || "").trim();
  const data = event?.data || {};
  const refundReference = data.reference || data.id || data.refund_reference || null;

  const patch = {
    "payment.refundLastEvent": eventName,
    "payment.refundLastEventAt": FieldValue.serverTimestamp(),
  };

  if (refundReference) patch["payment.refundReference"] = refundReference;

  if (eventName === "refund.processed") {
    patch["payment.status"] = "refunded";
    patch["payment.refundedAt"] = FieldValue.serverTimestamp();
    patch["payment.refundError"] = FieldValue.delete();
  } else if (["refund.failed", "refund.needs-attention"].includes(eventName)) {
    patch["payment.status"] = "refund_pending";
    patch["payment.refundError"] = data.reason || data.message || eventName;
  } else if (["refund.pending", "refund.processing"].includes(eventName)) {
    patch["payment.status"] = "refund_pending";
  }

  await ref.update(patch);

  return {
    orderId,
    event: eventName,
    payment: patch["payment.status"] || "unchanged",
  };
}

module.exports = {
  initiateRefund,
  recordRefundEvent,
};
