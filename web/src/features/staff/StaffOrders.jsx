import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
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
  markRefundDone,
  rejectOrder,
  watchActiveOrders,
} from "./orders";
import "./staff.css";

const STATUS_LABEL = {
  pending_approval: "Needs approval",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
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

  if (!value || Number.isNaN(value.getTime())) {
    return 0;
  }

  return value.getTime();
}

function ageMinutes(order) {
  const created = orderTime(order);

  if (!created) return 0;

  return Math.max(0, Math.floor((Date.now() - created) / 60000));
}

function urgency(order) {
  if (order.requiresApproval && order.status === "pending_approval") {
    return "critical";
  }

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

export default function StaffOrders({
  role,
  uid,
  dark,
  onOpenActive,
}) {
  const [orders, setOrders] = useState([]);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [reasonFor, setReasonFor] = useState(null);
  const [reasonText, setReasonText] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  const knownIds = useRef(new Set());
  const firstLoad = useRef(true);

  useEffect(() => {
    const unsubscribe = watchActiveOrders((next) => {
      const ids = new Set(next.map((order) => order.id));
      knownIds.current = ids;
      firstLoad.current = false;
      setOrders(next);
    });

    return unsubscribe;
  }, []);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    const result = orders.filter((order) => {
      if (status !== "all" && order.status !== status) {
        return false;
      }

      const orderUrgency = urgency(order);

      if (
        urgencyFilter !== "all" &&
        orderUrgency !== urgencyFilter
      ) {
        return false;
      }

      if (!query) return true;

      const searchable = [
        order.orderNumber,
        order.customer?.name,
        order.customer?.phone,
        order.customer?.email,
        order.address?.formattedAddress,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });

    return [...result].sort((a, b) => {
      if (sort === "highest") {
        return (
          Number(b.pricing?.total || 0) -
          Number(a.pricing?.total || 0)
        );
      }

      if (sort === "oldest") {
        return orderTime(a) - orderTime(b);
      }

      return orderTime(b) - orderTime(a);
    });
  }, [orders, search, status, urgencyFilter, sort]);

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
    if (!reasonFor) return;

    const { order, kind } = reasonFor;

    await run(order, () =>
      kind === "reject"
        ? rejectOrder(order.id, reasonText)
        : cancelOrder(order.id, reasonText)
    );

    setReasonFor(null);
  };

  const counts = useMemo(() => {
    return {
      all: orders.length,
      pending_approval: orders.filter(
        (order) => order.status === "pending_approval"
      ).length,
      confirmed: orders.filter(
        (order) => order.status === "confirmed"
      ).length,
      preparing: orders.filter(
        (order) => order.status === "preparing"
      ).length,
      ready: orders.filter(
        (order) => order.status === "ready"
      ).length,
      out_for_delivery: orders.filter(
        (order) => order.status === "out_for_delivery"
      ).length,
    };
  }, [orders]);

  return (
    <div className="v2-orders-workspace">
      {error && <div className="v2-error">{error}</div>}

      <div className="v2-order-summary">
        <SummaryPill
          label="Active"
          value={counts.all}
          active={status === "all"}
          onClick={() => setStatus("all")}
        />

        <SummaryPill
          label="Approval"
          value={counts.pending_approval}
          active={status === "pending_approval"}
          danger={counts.pending_approval > 0}
          onClick={() => setStatus("pending_approval")}
        />

        <SummaryPill
          label="Confirmed"
          value={counts.confirmed}
          active={status === "confirmed"}
          onClick={() => setStatus("confirmed")}
        />

        <SummaryPill
          label="Preparing"
          value={counts.preparing}
          active={status === "preparing"}
          onClick={() => setStatus("preparing")}
        />

        <SummaryPill
          label="Ready"
          value={counts.ready}
          active={status === "ready"}
          onClick={() => setStatus("ready")}
        />

        <SummaryPill
          label="Delivery"
          value={counts.out_for_delivery}
          active={status === "out_for_delivery"}
          onClick={() => setStatus("out_for_delivery")}
        />
      </div>

      <section className="v2-orders-panel">
        <div className="v2-orders-toolbar">
          <div className="v2-order-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order number or customer..."
            />
          </div>

          <div className="v2-filter-group">
            <SlidersHorizontal size={16} />

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {STATUS_OPTIONS.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={urgencyFilter}
              onChange={(event) =>
                setUrgencyFilter(event.target.value)
              }
            >
              <option value="all">All urgency</option>
              <option value="critical">Needs attention</option>
              <option value="warning">Aging</option>
              <option value="late">Running long</option>
              <option value="normal">Normal</option>
            </select>

            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              {SORT_OPTIONS.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="v2-orders-meta">
          <span>
            Showing <strong>{filteredOrders.length}</strong> of{" "}
            <strong>{orders.length}</strong> active orders
          </span>

          <span className="v2-live-indicator">
            <i />
            Live
          </span>
        </div>

        <div className="v2-order-list">
          {filteredOrders.length === 0 && (
            <div className="v2-empty-orders">
              <ClipboardIcon />
              <h3>No orders match these filters</h3>
              <p>
                Try changing the search, status or urgency filter.
              </p>
            </div>
          )}

          {filteredOrders.map((order) => (
            <StaffOrderRow
              key={order.id}
              order={order}
              role={role}
              uid={uid}
              busy={busyId === order.id}
              onOpen={() => onOpenActive?.(order)}
              onAdvance={(target) =>
                run(order, () =>
                  advanceStatus(order.id, target)
                )
              }
              onApprove={() =>
                run(order, () => approveOrder(order.id))
              }
              onReject={() => openReason(order, "reject")}
              onCancel={() => openReason(order, "cancel")}
              onClaim={() =>
                run(order, () => claimOrder(order.id))
              }
              onRefundDone={() =>
                run(order, () => markRefundDone(order.id))
              }
            />
          ))}
        </div>
      </section>

      {reasonFor && (
        <div
          className="modal-backdrop"
          onClick={() => setReasonFor(null)}
        >
          <div
            className="reason-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>
              {reasonFor.kind === "reject"
                ? "Reject order"
                : "Cancel order"}{" "}
              {reasonFor.order.orderNumber}
            </h3>

            <textarea
              rows={4}
              value={reasonText}
              onChange={(event) =>
                setReasonText(event.target.value)
              }
              placeholder="Reason (the customer will see this)"
            />

            <div className="reason-actions">
              <button onClick={() => setReasonFor(null)}>
                Never mind
              </button>

              <button
                className="primary-button"
                disabled={!reasonText.trim() || Boolean(busyId)}
                onClick={submitReason}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryPill({
  label,
  value,
  active,
  danger,
  onClick,
}) {
  return (
    <button
      className={`v2-summary-pill ${active ? "active" : ""} ${
        danger ? "danger" : ""
      }`}
      onClick={onClick}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  );
}

function StaffOrderRow({
  order,
  role,
  uid,
  busy,
  onOpen,
  onAdvance,
  onApprove,
  onReject,
  onCancel,
  onClaim,
  onRefundDone,
}) {
  const orderUrgency = urgency(order);
  const isMine = order.riderId === uid;

  const canOpenActive =
    (role === "kitchen" && order.status === "preparing") ||
    (role === "rider" &&
      isMine &&
      ["ready", "out_for_delivery"].includes(order.status));

  return (
    <article className={`v2-order-row urgency-${orderUrgency}`}>
      <div className="v2-order-main">
        <div className="v2-order-id">
          <strong>{order.orderNumber}</strong>

          {order.requiresApproval &&
            order.status === "pending_approval" && (
              <span className="v2-order-alert">
                <AlertTriangle size={13} />
                Large
              </span>
            )}
        </div>

        <div className="v2-order-customer">
          <strong>{order.customer?.name || "Customer"}</strong>

          {order.customer?.phone && (
            <a href={`tel:${order.customer.phone}`}>
              <Phone size={13} />
              {order.customer.phone}
            </a>
          )}
        </div>

        <div className="v2-order-items-preview">
          {(order.items || []).slice(0, 2).map((item, index) => (
            <span key={index}>
              {item.quantity}× {item.name}
            </span>
          ))}

          {(order.items || []).length > 2 && (
            <span>+{order.items.length - 2} more</span>
          )}
        </div>
      </div>

      <div className="v2-order-status">
        <span className={`v2-status status-${order.status}`}>
          {STATUS_LABELS[order.status] || order.status}
        </span>

        <span className="v2-urgency">
          {orderUrgency === "late" && <Clock3 size={13} />}
          {urgencyLabel(orderUrgency)}
        </span>
      </div>

      <div className="v2-order-location">
        <MapPin size={14} />

        <span>
          {order.address?.formattedAddress ||
            "No delivery address"}
        </span>
      </div>

      <div className="v2-order-value">
        <strong>{formatMoney(order.pricing?.total)}</strong>
        <span>{ageMinutes(order)} min old</span>
      </div>

      <div className="v2-order-actions">
        <button
          className="v2-secondary-action"
          onClick={onOpen}
        >
          Details
        </button>

        {role === "admin" &&
          order.status === "pending_approval" && (
            <>
              <button
                className="v2-primary-action"
                disabled={busy}
                onClick={onApprove}
              >
                Approve
              </button>

              <button
                className="v2-danger-action"
                disabled={busy}
                onClick={onReject}
              >
                Reject
              </button>
            </>
          )}

        {role === "admin" &&
          !["pending_approval", "out_for_delivery"].includes(
            order.status
          ) && (
            <button
              className="v2-danger-action"
              disabled={busy}
              onClick={onCancel}
            >
              Cancel
            </button>
          )}

        {role === "kitchen" &&
          order.status === "confirmed" && (
            <button
              className="v2-primary-action"
              disabled={busy}
              onClick={() => onAdvance("preparing")}
            >
              Start
            </button>
          )}

        {role === "kitchen" &&
          order.status === "preparing" && (
            <button
              className="v2-primary-action"
              disabled={busy}
              onClick={() => onAdvance("ready")}
            >
              Ready
            </button>
          )}

        {role === "rider" &&
          order.status === "ready" &&
          !order.riderId && (
            <button
              className="v2-primary-action"
              disabled={busy}
              onClick={onClaim}
            >
              Claim
            </button>
          )}

        {role === "rider" &&
          order.status === "out_for_delivery" &&
          isMine && (
            <button
              className="v2-primary-action"
              disabled={busy}
              onClick={() => onAdvance("delivered")}
            >
              Delivered
            </button>
          )}

        {role === "admin" &&
          order.payment?.status === "refund_pending" && (
            <button
              className="v2-refund-action"
              disabled={busy}
              onClick={onRefundDone}
            >
              Mark refunded
            </button>
          )}

        {canOpenActive && (
          <button
            className="v2-active-action"
            onClick={onOpen}
          >
            Active
          </button>
        )}
      </div>
    </article>
  );
}

function ClipboardIcon() {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4" />
    </svg>
  );
              }
