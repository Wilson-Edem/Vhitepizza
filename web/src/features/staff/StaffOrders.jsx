import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock3,
  MapPin,
  Phone,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  advanceStatus,
  approveOrder,
  cancelOrder,
  claimOrder,
  flagProblem,
  markRefundDone,
  rejectOrder,
  watchActiveOrders,
} from "./orders";
import "./staff.css";

export const STATUS_LABELS = {
  pending_approval: "Needs Approval",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  rejected: "Rejected",
};

const STATUS_OPTIONS = [
  ["all", "All statuses"],
  ["pending_approval", "Needs approval"],
  ["confirmed", "Confirmed"],
  ["preparing", "Preparing"],
  ["ready", "Ready"],
  ["out_for_delivery", "Out for delivery"],
];

const SORT_OPTIONS = [
  ["newest", "Newest first"],
  ["oldest", "Oldest first"],
  ["highest", "Highest value"],
];

const formatMoney = (value) =>
  `₦${Number(value || 0).toLocaleString("en-NG")}`;

function orderTime(order) {
  const value =
    order.createdAt?.toDate?.() ||
    (order.createdAt ? new Date(order.createdAt) : null);
  return value && !Number.isNaN(value.getTime()) ? value.getTime() : 0;
}

function ageMinutes(order) {
  const created = orderTime(order);
  return created ? Math.max(0, Math.floor((Date.now() - created) / 60000)) : 0;
}

function urgency(order) {
  if (order.requiresApproval && order.status === "pending_approval") return "critical";
  const age = ageMinutes(order);
  if (age >= 60) return "late";
  if (age >= 35) return "warning";
  return "normal";
}

function urgencyLabel(value) {
  if (value === "critical") return "Needs attention";
  if (value === "late") return "Running long";
  if (value === "warning") return "Aging";
  return "Normal";
}

export default function StaffOrders({ role, uid, dark, onOpenActive }) {
  const [orders, setOrders] = useState([]);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [reasonFor, setReasonFor] = useState(null);
  const [reasonText, setReasonText] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    const unsubscribe = watchActiveOrders(
      (next) => setOrders(next),
      (listenerError) => setError(listenerError.message || "Live order updates failed.")
    );
    return unsubscribe;
  }, []);

  const filteredOrders = useMemo(() => {
    const queryText = search.trim().toLowerCase();
    const result = orders.filter((order) => {
      if (status !== "all" && order.status !== status) return false;
      if (urgencyFilter !== "all" && urgency(order) !== urgencyFilter) return false;
      if (!queryText) return true;
      return [
        order.orderNumber,
        order.customer?.name,
        order.customer?.phone,
        order.customer?.email,
        order.address?.formattedAddress,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(queryText);
    });

    return [...result].sort((a, b) => {
      if (sort === "highest") return Number(b.pricing?.total || 0) - Number(a.pricing?.total || 0);
      if (sort === "oldest") return orderTime(a) - orderTime(b);
      return orderTime(b) - orderTime(a);
    });
  }, [orders, search, status, urgencyFilter, sort]);

  const counts = useMemo(
    () => ({
      all: orders.length,
      pending_approval: orders.filter((o) => o.status === "pending_approval").length,
      confirmed: orders.filter((o) => o.status === "confirmed").length,
      preparing: orders.filter((o) => o.status === "preparing").length,
      ready: orders.filter((o) => o.status === "ready").length,
      out_for_delivery: orders.filter((o) => o.status === "out_for_delivery").length,
    }),
    [orders]
  );

  const run = async (order, task) => {
    setBusyId(order.id);
    setError("");
    try {
      await task();
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusyId("");
    }
  };

  const openReason = (order, kind) => {
    setReasonFor({ order, kind });
    setReasonText("");
  };

  const submitReason = async () => {
    if (!reasonFor || !reasonText.trim()) return;
    const { order, kind } = reasonFor;
    await run(order, () =>
      kind === "problem"
        ? flagProblem(order.id, reasonText)
        : kind === "reject"
        ? rejectOrder(order.id, reasonText)
        : cancelOrder(order.id, reasonText)
    );
    setReasonFor(null);
    setReasonText("");
  };

  return (
    <div className="v2-orders-workspace">
      {error && <div className="v2-error">{error}</div>}

      <div className="v2-order-summary">
        {[
          ["Active", "all", counts.all, false],
          ["Approval", "pending_approval", counts.pending_approval, counts.pending_approval > 0],
          ["Confirmed", "confirmed", counts.confirmed, false],
          ["Preparing", "preparing", counts.preparing, false],
          ["Ready", "ready", counts.ready, false],
          ["Delivery", "out_for_delivery", counts.out_for_delivery, false],
        ].map(([label, value, count, danger]) => (
          <button
            type="button"
            key={value}
            className={`v2-summary-pill ${status === value ? "active" : ""} ${danger ? "danger" : ""}`}
            onClick={() => setStatus(value)}
          >
            <span>{label}</span>
            <strong>{count}</strong>
          </button>
        ))}
      </div>

      <section className="v2-orders-panel">
        <div className="v2-orders-toolbar">
          <div className="v2-order-search">
            <Search size={17} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order number or customer..." />
          </div>

          <div className="v2-filter-group">
            <SlidersHorizontal size={16} />
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
            <select value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)}>
              <option value="all">All urgency</option>
              <option value="critical">Needs attention</option>
              <option value="warning">Aging</option>
              <option value="late">Running long</option>
              <option value="normal">Normal</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORT_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </div>
        </div>

        <div className="v2-orders-meta">
          <span>Showing <strong>{filteredOrders.length}</strong> of <strong>{orders.length}</strong> active orders</span>
          <span className="v2-live-indicator"><i /> Live</span>
        </div>

        <div className="v2-order-list">
          {filteredOrders.length === 0 ? (
            <div className="v2-empty-orders"><ClipboardIcon /><h3>No orders match these filters</h3><p>Try changing the search, status or urgency filter.</p></div>
          ) : filteredOrders.map((order) => (
            <StaffOrderRow
              key={order.id}
              order={order}
              role={role}
              uid={uid}
              busy={busyId === order.id}
              onOpen={() => onOpenActive?.(order)}
              onAdvance={(target) => run(order, () => advanceStatus(order.id, target))}
              onApprove={() => run(order, () => approveOrder(order.id))}
              onReject={() => openReason(order, "reject")}
              onCancel={() => openReason(order, "cancel")}
              onClaim={() => run(order, () => claimOrder(order.id))}
              onProblem={() => openReason(order, "problem")}
              onRefundDone={() => run(order, () => markRefundDone(order.id))}
            />
          ))}
        </div>
      </section>

      {reasonFor && (
        <div className="v2-reason-backdrop" onClick={() => setReasonFor(null)}>
          <div className="v2-reason-modal" onClick={(e) => e.stopPropagation()}>
            <span>{reasonFor.kind === "problem" ? "FLAG A PROBLEM" : reasonFor.kind === "reject" ? "REJECT ORDER" : "CANCEL ORDER"}</span>
            <h3>{reasonFor.order.orderNumber}</h3>
            <p>{reasonFor.kind === "problem" ? "Describe what the kitchen or delivery team needs attention on." : "A short reason is required for this action."}</p>
            <textarea autoFocus value={reasonText} onChange={(e) => setReasonText(e.target.value)} maxLength={500} rows={5} placeholder="Enter a reason..." />
            <div className="v2-reason-actions">
              <button type="button" onClick={() => setReasonFor(null)}>Close</button>
              <button type="button" className="v2-primary-action" disabled={!reasonText.trim() || busyId === reasonFor.order.id} onClick={submitReason}>Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StaffOrderRow({ order, role, uid, busy, onOpen, onAdvance, onApprove, onReject, onCancel, onClaim, onProblem, onRefundDone }) {
  const orderUrgency = urgency(order);
  const isMine = order.riderId === uid;
  const canOpenActive =
    (role === "kitchen" && order.status === "preparing") ||
    (role === "rider" && isMine && ["ready", "out_for_delivery"].includes(order.status));

  return (
    <article className={`v2-order-row urgency-${orderUrgency}`}>
      <div className="v2-order-main">
        <div className="v2-order-id">
          <strong>{order.orderNumber}</strong>
          {order.requiresApproval && order.status === "pending_approval" && <span className="v2-order-alert"><AlertTriangle size={13} /> Large</span>}
          {order.problem?.active && <span className="v2-problem-tag"><AlertTriangle size={12} /> Problem</span>}
        </div>
        <div className="v2-order-customer">
          <strong>{order.customer?.name || "Customer"}</strong>
          {order.customer?.phone && <a href={`tel:${order.customer.phone}`}><Phone size={13} />{order.customer.phone}</a>}
        </div>
        <div className="v2-order-items-preview">
          {(order.items || []).slice(0, 2).map((item, index) => <span key={index}>{item.quantity}× {item.name}</span>)}
          {(order.items || []).length > 2 && <span>+{order.items.length - 2} more</span>}
        </div>
      </div>

      <div className="v2-order-status">
        <span className={`v2-status status-${order.status}`}>{STATUS_LABELS[order.status] || order.status}</span>
        <span className="v2-urgency">{orderUrgency === "late" && <Clock3 size={13} />}{urgencyLabel(orderUrgency)}</span>
      </div>

      <div className="v2-order-location"><MapPin size={14} /><span>{order.address?.formattedAddress || "No delivery address"}</span></div>
      <div className="v2-order-value"><strong>{formatMoney(order.pricing?.total)}</strong><span>{ageMinutes(order)} min old</span></div>

      <div className="v2-order-actions">
        <button className="v2-secondary-action" onClick={onOpen}>Details</button>

        {role === "admin" && order.status === "pending_approval" && <>
          <button className="v2-primary-action" disabled={busy} onClick={onApprove}>Approve</button>
          <button className="v2-danger-action" disabled={busy} onClick={onReject}>Reject</button>
        </>}

        {role === "admin" && !["pending_approval", "out_for_delivery"].includes(order.status) && <button className="v2-danger-action" disabled={busy} onClick={onCancel}>Cancel</button>}

        {role === "kitchen" && order.status === "confirmed" && <button className="v2-primary-action" disabled={busy} onClick={() => onAdvance("preparing")}>Start Preparing</button>}
        {role === "kitchen" && order.status === "preparing" && <button className="v2-primary-action" disabled={busy} onClick={() => onAdvance("ready")}>Mark Ready</button>}

        {role === "rider" && order.status === "ready" && !order.riderId && <button className="v2-primary-action" disabled={busy} onClick={onClaim}>Claim Delivery</button>}
        {role === "rider" && order.status === "ready" && isMine && <button className="v2-active-action" disabled={busy} onClick={() => onAdvance("out_for_delivery")}>Start Delivery</button>}
        {role === "rider" && order.status === "out_for_delivery" && isMine && <button className="v2-primary-action" disabled={busy} onClick={() => onAdvance("delivered")}>Mark Delivered</button>}

        {(role === "kitchen" || (role === "rider" && isMine)) && !["delivered", "cancelled"].includes(order.status) && <button className="v2-problem-action" disabled={busy} onClick={onProblem}>Flag Problem</button>}

        {role === "admin" && order.payment?.status === "refund_pending" && <button className="v2-refund-action" disabled={busy} onClick={onRefundDone}>Mark refunded</button>}
        {canOpenActive && <button className="v2-active-action" onClick={onOpen}>Active</button>}
      </div>
    </article>
  );
}

function ClipboardIcon() {
  return <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4" /></svg>;
}
