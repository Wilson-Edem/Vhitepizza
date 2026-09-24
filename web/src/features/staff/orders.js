import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { apiFetch } from "../../lib/api";

const ACTIVE = [
  "pending_approval",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
];

export function watchActiveOrders(onChange, onError) {
  const q = query(
    collection(db, "orders"),
    where("status", "in", ACTIVE),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      onChange(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    },
    (error) => {
      console.error("Staff order listener failed:", error);
      onError?.(error);
    }
  );
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

export const flagProblem = (orderId, reason) =>
  apiFetch(`/orders/${orderId}/problem`, {
    method: "POST",
    body: { reason },
  });

export const markRefundDone = (orderId) =>
  apiFetch(`/orders/${orderId}/refund-done`, { method: "POST" });

export const listAllUsers = (role) =>
  apiFetch(`/admin/users?role=${encodeURIComponent(role)}`);

export const setUserActive = (uid, active) =>
  apiFetch(`/admin/users/${uid}/active`, {
    method: "PATCH",
    body: { active },
  });
