const { db, FieldValue } = require("../config/firebase");
const { HttpError } = require("../utils/errors");
const { distanceKm, plain } = require("../utils/geo");
const { getMenu } = require("./menu");
const { getSettings } = require("./settings");
const { priceCart } = require("./pricing");
const { STATUS, assertTransition, isTerminal } = require("./status");
const { sendLargeOrderEmail } = require("./email");

const SYSTEM = { uid: null, role: "system" };
const STAFF_ROLES = ["admin", "kitchen", "rider"];

// Which timestamp field is filled in when an order reaches a status.
const STAMPS = {
  confirmed: "confirmedAt",
  preparing: "preparingAt",
  ready: "readyAt",
  out_for_delivery: "pickedUpAt",
  delivered: "deliveredAt",
  cancelled: "cancelledAt",
};

function requireDb() {
  if (!db) throw new HttpError(503, "Database is not available.");
}

const entry = (status, actor, note = "") => ({
  status,
  at: new Date(),
  byUid: actor.uid || null,
  byRole: actor.role,
  note,
});

function checkDistance(address, settings) {
  const place = settings.restaurantLocation;

  if (
    settings.maxDist > 0 &&
    place &&
    Number.isFinite(address.lat) &&
    Number.isFinite(address.lng)
  ) {
    const km = distanceKm(place.lat, place.lng, address.lat, address.lng);

    if (km > settings.maxDist) {
      throw new HttpError(
        422,
        `Sorry, we only deliver within ${settings.maxDist} km of the restaurant.`
      );
    }
  }
}

const isLarge = (total, itemCount, settings) =>
  (settings.largeTotal > 0 && total >= settings.largeTotal) ||
  (settings.largeItems > 0 && itemCount >= settings.largeItems);

/* ---------- create ---------- */

// The server recalculates every price from the menu. Prices sent by the
// browser are never used.
async function createOrder({ user, items, address }) {
  requireDb();

  const [{ data: menu }, settings] = await Promise.all([
    getMenu(),
    getSettings(),
  ]);

  if (!settings.isOpen) {
    throw new HttpError(409, "The restaurant is closed right now.");
  }

  const priced = priceCart(menu, items, settings.flatDeliveryFee);

  checkDistance(address, settings);

  const itemCount = priced.lines.reduce((sum, line) => sum + line.quantity, 0);
  const requiresApproval = isLarge(priced.total, itemCount, settings);

  const profile =
    (await db.collection("users").doc(user.uid).get()).data() || {};

  const counterRef = db.collection("counters").doc("orders");
  const orderRef = db.collection("orders").doc();
  let orderNumber = "";

  await db.runTransaction(async (tx) => {
    const counter = await tx.get(counterRef);
    const last = counter.exists ? Number(counter.data().last) || 1000 : 1000;

    orderNumber = `VP-${last + 1}`;

    tx.set(counterRef, { last: last + 1 });
    tx.set(orderRef, {
      orderNumber,
      customerId: user.uid,
      customer: {
        name: profile.displayName || user.name || "",
        phone: address.phone,
        email: user.email || profile.email || "",
      },
      items: priced.lines,
      address: {
        formattedAddress: address.formattedAddress,
        lat: address.lat ?? null,
        lng: address.lng ?? null,
        phone: address.phone,
        landmark: address.landmark || "",
        notes: address.notes || "",
        source: address.source || "manual",
      },
      pricing: {
        subtotal: priced.subtotal,
        deliveryFee: priced.deliveryFee,
        total: priced.total,
      },
      status: STATUS.AWAITING_PAYMENT,
      statusHistory: [
        entry(STATUS.AWAITING_PAYMENT, { uid: user.uid, role: "customer" }),
      ],
      requiresApproval,
      approval: {
        state: requiresApproval ? "pending" : "none",
        byUid: null,
        at: null,
        reason: "",
      },
      payment: {
        provider: "paystack",
        reference: null,
        status: "pending",
        paidAt: null,
      },
      riderId: null,
      riderAssignedBy: null,
      cancelledBy: null,
      cancelReason: "",
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return {
    id: orderRef.id,
    orderNumber,
    status: STATUS.AWAITING_PAYMENT,
    requiresApproval,
    pricing: {
      subtotal: priced.subtotal,
      deliveryFee: priced.deliveryFee,
      total: priced.total,
    },
  };
}

/* ---------- payment confirmed (called by Paystack verification later) ---------- */

async function markPaid(orderId, reference = "") {
  requireDb();

  const settings = await getSettings();
  const ref = db.collection("orders").doc(orderId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists) throw new HttpError(404, "Order not found.");

    const order = snap.data();

    if (order.payment?.status === "paid") {
      return { id: orderId, status: order.status };
    }

    if (order.status !== STATUS.AWAITING_PAYMENT) {
      throw new HttpError(409, "This order can no longer be paid.");
    }

    let status = order.status;
    const history = [...(order.statusHistory || [])];
    const patch = {
      "payment.status": "paid",
      "payment.reference": reference,
      "payment.paidAt": FieldValue.serverTimestamp(),
      placedAt: FieldValue.serverTimestamp(),
    };

    const move = (to, note = "") => {
      assertTransition(status, to, "system");
      status = to;
      history.push(entry(to, SYSTEM, note));

      if (STAMPS[to]) patch[STAMPS[to]] = FieldValue.serverTimestamp();
    };

    move(STATUS.PLACED);

    if (order.requiresApproval) {
      move(STATUS.PENDING_APPROVAL, "Waiting for admin approval");
    } else {
      move(STATUS.CONFIRMED);

      if (settings.cancelGraceMinutes <= 0) move(STATUS.PREPARING);
    }

    tx.update(ref, { ...patch, status, statusHistory: history });

    return {
      id: orderId,
      status,
      orderNumber: order.orderNumber,
      customer: order.customer,
      pricing: order.pricing,
    };
  }).then((result) => {
    if (result.status === STATUS.PENDING_APPROVAL) {
      sendLargeOrderEmail(result).catch(() => {});
    }

    return { id: result.id, status: result.status };
  });
}

/* ---------- status changes ---------- */

async function changeStatus(orderId, to, actor, reason = "") {
  requireDb();

  const settings = await getSettings();
  const ref = db.collection("orders").doc(orderId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists) throw new HttpError(404, "Order not found.");

    const order = snap.data();

    if (actor.role === "customer" && order.customerId !== actor.uid) {
      throw new HttpError(403, "This is not your order.");
    }

    if (
      actor.role === "rider" &&
      [STATUS.OUT_FOR_DELIVERY, STATUS.DELIVERED].includes(to) &&
      order.riderId !== actor.uid
    ) {
      throw new HttpError(403, "Claim this order first.");
    }

    const needsReason =
      to === STATUS.CANCELLED && !["customer", "system"].includes(actor.role);

    if (needsReason && !reason.trim()) {
      throw new HttpError(400, "Please give a reason.");
    }

    let status = order.status;
    const history = [...(order.statusHistory || [])];
    const patch = {};

    const move = (next, by, note = "") => {
      assertTransition(status, next, by.role);
      status = next;
      history.push(entry(next, by, note));

      if (STAMPS[next]) patch[STAMPS[next]] = FieldValue.serverTimestamp();
    };

    move(to, actor, to === STATUS.CANCELLED ? reason : "");

    if (order.status === STATUS.PENDING_APPROVAL && actor.role === "admin") {
      patch["approval.state"] = to === STATUS.CONFIRMED ? "approved" : "rejected";
      patch["approval.byUid"] = actor.uid;
      patch["approval.at"] = new Date();
      patch["approval.reason"] = to === STATUS.CANCELLED ? reason : "";
    }

    // With no grace period, a confirmed order goes straight to preparing.
    if (to === STATUS.CONFIRMED && settings.cancelGraceMinutes <= 0) {
      move(STATUS.PREPARING, SYSTEM);
    }

    if (to === STATUS.CANCELLED) {
      patch.cancelledBy = actor.role;
      patch.cancelReason = reason;

      if (order.payment?.status === "paid") {
        patch["payment.status"] = "refund_pending";
      }
    }

    tx.update(ref, { ...patch, status, statusHistory: history });

    return { id: orderId, status };
  });
}

/* ---------- riders and refunds ---------- */

async function assignRider(orderId, riderId) {
  requireDb();

  const rider = (await db.collection("users").doc(riderId).get()).data();

  if (!rider || rider.role !== "rider" || rider.active === false) {
    throw new HttpError(400, "That user is not an active rider.");
  }

  const ref = db.collection("orders").doc(orderId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists) throw new HttpError(404, "Order not found.");
    if (isTerminal(snap.data().status)) {
      throw new HttpError(409, "This order is already finished.");
    }

    tx.update(ref, { riderId, riderAssignedBy: "admin" });

    return { id: orderId, riderId };
  });
}

async function claimOrder(orderId, riderUid) {
  requireDb();

  const ref = db.collection("orders").doc(orderId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists) throw new HttpError(404, "Order not found.");

    const order = snap.data();

    if (order.status !== STATUS.READY || order.riderId) {
      throw new HttpError(409, "This order is not available to claim.");
    }

    tx.update(ref, { riderId: riderUid, riderAssignedBy: "self" });

    return { id: orderId, riderId: riderUid };
  });
}

async function markRefundDone(orderId) {
  requireDb();

  const ref = db.collection("orders").doc(orderId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists) throw new HttpError(404, "Order not found.");
    if (snap.data().payment?.status !== "refund_pending") {
      throw new HttpError(409, "No refund is pending for this order.");
    }

    tx.update(ref, { "payment.status": "refunded" });

    return { id: orderId, payment: "refunded" };
  });
}

/* ---------- reading ---------- */

const ACTIVE_STATUSES = [
  "pending_approval",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
];

// For the staff dashboards: every order still being worked on, or a
// specific status if one is given. Riders only see unclaimed orders plus
// their own; admin and kitchen see everything in view.
async function listForStaff({ status, role, uid }) {
  requireDb();

  let query = db.collection("orders");

  query =
    status && status !== "active"
      ? query.where("status", "==", status)
      : query.where("status", "in", ACTIVE_STATUSES);

  const snapshot = await query.orderBy("createdAt", "asc").limit(100).get();
  let orders = snapshot.docs.map((doc) => plain({ id: doc.id, ...doc.data() }));

  if (role === "rider") {
    orders = orders.filter((order) => !order.riderId || order.riderId === uid);
  }

  return orders;
}

async function listMine(uid) {
  requireDb();

  const snapshot = await db
    .collection("orders")
    .where("customerId", "==", uid)
    .limit(50)
    .get();

  return snapshot.docs
    .map((doc) => plain({ id: doc.id, ...doc.data() }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

async function getOrder(orderId, user) {
  requireDb();

  const snap = await db.collection("orders").doc(orderId).get();

  if (!snap.exists) throw new HttpError(404, "Order not found.");

  const order = snap.data();
  const role = user.role || "customer";

  if (order.customerId !== user.uid && !STAFF_ROLES.includes(role)) {
    throw new HttpError(403, "This is not your order.");
  }

  return plain({ id: snap.id, ...order });
}

/* ---------- payment reference ---------- */

async function setPaymentReference(orderId, reference) {
  requireDb();

  const clean = String(reference || "").trim();

  if (!clean) {
    throw new HttpError(400, "Payment reference is required.");
  }

  const ref = db.collection("orders").doc(orderId);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new HttpError(404, "Order not found.");
  }

  await ref.update({
    "payment.reference": clean,
    "payment.status": "pending",
    "payment.initializedAt": FieldValue.serverTimestamp(),
  });

  return { id: orderId, reference: clean };
}

async function findOrderIdByPaymentReference(reference) {
  requireDb();

  const clean = String(reference || "").trim();

  if (!clean) return null;

  const snapshot = await db
    .collection("orders")
    .where("payment.reference", "==", clean)
    .limit(1)
    .get();

  return snapshot.empty ? null : snapshot.docs[0].id;
}

module.exports = {
  SYSTEM,
  createOrder,
  markPaid,
  changeStatus,
  assignRider,
  claimOrder,
  markRefundDone,
  listMine,
  listForStaff,
  getOrder,
  setPaymentReference,
  findOrderIdByPaymentReference,
};