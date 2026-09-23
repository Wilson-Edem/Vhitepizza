import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { apiFetch } from "../../lib/api";

const ACTIVE = ["pending_approval", "confirmed", "preparing", "ready", "out_for_delivery"];

// Live updates from Firestore, so the board refreshes itself. Staff can read
// these under firestore.rules; only the server can write them.
export function watchActiveOrders(onChange) {
  const q = query(
    collection(db, "orders"),
    where("status", "in", ACTIVE),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(q, (snapshot) => {
    onChange(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  });
}

export const advanceStatus = (orderId, status) =>
  apiFetch(`/orders/${orderId}/status`, { method: "PATCH", body: { status } });

export const approveOrder = (orderId) =>
  apiFetch(`/orders/${orderId}/approve`, { method: "POST" });

export const rejectOrder = (orderId, reason) =>
  apiFetch(`/orders/${orderId}/reject`, { method: "POST", body: { reason } });

export const cancelOrder = (orderId, reason) =>
  apiFetch(`/orders/${orderId}/status`, {
    method: "PATCH",
    body: { status: "cancelled", reason },
  });

export const claimOrder = (orderId) =>
  apiFetch(`/orders/${orderId}/claim`, { method: "POST" });

export const markRefundDone = (orderId) =>
  apiFetch(`/orders/${orderId}/refund-done`, { method: "POST" });

// ---------- Admin users ----------

export const listAllUsers = (role) =>
  apiFetch(`/admin/users?role=${encodeURIComponent(role)}`);

export const setUserActive = (uid, active) =>
  apiFetch(`/admin/users/${uid}/active`, {
    method: "PATCH",
    body: { active },
  });