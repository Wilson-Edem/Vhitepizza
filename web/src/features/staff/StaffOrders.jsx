import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, MapPin, Phone } from "lucide-react";
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

const formatMoney = (value) => `₦${Number(value || 0).toLocaleString("en-NG")}`;

const STATUS_LABEL = {
  pending_approval: "Needs Approval",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for Delivery",
};

// Which statuses each role sees, and what "advance" means for them.
const BOARDS = {
  admin: {
    columns: ["pending_approval", "confirmed", "preparing", "ready", "out_for_delivery"],
  },
  kitchen: {
    columns: ["confirmed", "preparing"],
    advanceFrom: "preparing",
    advanceTo: "ready",
    advanceLabel: "Mark Ready",
  },
  rider: {
    columns: ["ready", "out_for_delivery"],
  },
};

export default function StaffOrders({ role, uid }) {
  const [orders, setOrders] = useState([]);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [reasonFor, setReasonFor] = useState(null);
  const [reasonText, setReasonText] = useState("");

  const board = BOARDS[role] || BOARDS.admin;

  useEffect(() => {
    const unsubscribe = watchActiveOrders(setOrders);

    return unsubscribe;
  }, []);

  const columns = useMemo(
    () =>
      board.columns.map((status) => ({
        status,
        label: STATUS_LABEL[status],
        orders: orders.filter((order) => order.status === status),
      })),
    [orders, board]
  );

  const run = async (order, task) => {
    setBusyId(order.id);
    setError("");

    try {
      await task();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  };

  const openReason = (order, kind) => {
    setReasonFor({ order, kind });
    setReasonText("");
  };

  const submitReason = async () => {
    const { order, kind } = reasonFor;

    await run(order, () =>
      kind === "reject"
        ? rejectOrder(order.id, reasonText)
        : cancelOrder(order.id, reasonText)
    );

    setReasonFor(null);
  };

  return (
    <div className="staff-board">
      {error && <div className="loc-error">{error}</div>}

      <div className="staff-columns">
        {columns.map((column) => (
          <div className="staff-column" key={column.status}>
            <h3>
              {column.label}
              <span>{column.orders.length}</span>
            </h3>

            {column.orders.length === 0 && (
              <p className="staff-empty">Nothing here right now.</p>
            )}

            {column.orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                role={role}
                uid={uid}
                board={board}
                busy={busyId === order.id}
                onAdvance={() =>
                  run(order, () =>
                    advanceStatus(order.id, board.advanceTo || nextStatus(order.status, role))
                  )
                }
                onApprove={() => run(order, () => approveOrder(order.id))}
                onReject={() => openReason(order, "reject")}
                onCancel={() => openReason(order, "cancel")}
                onClaim={() => run(order, () => claimOrder(order.id))}
                onPickUp={() => run(order, () => advanceStatus(order.id, "out_for_delivery"))}
                onDeliver={() => run(order, () => advanceStatus(order.id, "delivered"))}
                onRefundDone={() => run(order, () => markRefundDone(order.id))}
              />
            ))}
          </div>
        ))}
      </div>

      {reasonFor && (
        <div className="modal-backdrop" onClick={() => setReasonFor(null)}>
          <div className="reason-modal" onClick={(event) => event.stopPropagation()}>
            <h3>
              {reasonFor.kind === "reject" ? "Reject order" : "Cancel order"}{" "}
              {reasonFor.order.orderNumber}
            </h3>

            <textarea
              rows={3}
              value={reasonText}
              onChange={(event) => setReasonText(event.target.value)}
              placeholder="Reason (the customer will see this)"
            />

            <div className="reason-actions">
              <button onClick={() => setReasonFor(null)}>Never mind</button>
              <button
                className="primary-button"
                disabled={!reasonText.trim()}
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

// Kitchen has one clear job (preparing -> ready); admin usually approves or
// waits for the customer/system, so this only covers the buttons shown.
function nextStatus(status, role) {
  if (role === "kitchen" && status === "preparing") return "ready";
  return status;
}

function OrderCard({
  order,
  role,
  uid,
  board,
  busy,
  onAdvance,
  onApprove,
  onReject,
  onCancel,
  onClaim,
  onPickUp,
  onDeliver,
  onRefundDone,
}) {
  const isMine = order.riderId === uid;
  const mapsLink =
    Number.isFinite(order.address?.lat) && Number.isFinite(order.address?.lng)
      ? `https://www.google.com/maps?q=${order.address.lat},${order.address.lng}`
      : null;

  return (
    <article className="order-card">
      <div className="order-card-top">
        <strong>{order.orderNumber}</strong>
        {order.requiresApproval && order.status === "pending_approval" && (
          <span className="order-tag">
            <AlertTriangle size={13} />
            Large order
          </span>
        )}
      </div>

      <ul className="order-items">
        {order.items?.map((item, index) => (
          <li key={index}>
            {item.quantity}× {item.name} ({item.sizeLabel})
          </li>
        ))}
      </ul>

      <div className="order-total">{formatMoney(order.pricing?.total)}</div>

      <div className="order-customer">
        <span>{order.customer?.name || "Customer"}</span>
        <a href={`tel:${order.customer?.phone}`}>
          <Phone size={13} />
          {order.customer?.phone}
        </a>
      </div>

      <p className="order-address">
        {order.address?.formattedAddress}
        {order.address?.landmark ? ` · Near ${order.address.landmark}` : ""}
      </p>

      {mapsLink && role !== "kitchen" && (
        <a className="order-map-link" href={mapsLink} target="_blank" rel="noreferrer">
          <MapPin size={13} />
          Open in Maps
        </a>
      )}

      {order.payment?.status === "refund_pending" && role === "admin" && (
        <div className="order-refund">
          <span>Refund pending</span>
          <button disabled={busy} onClick={onRefundDone}>
            Mark refunded
          </button>
        </div>
      )}

      <div className="order-actions">
        {role === "admin" && order.status === "pending_approval" && (
          <>
            <button className="primary-button" disabled={busy} onClick={onApprove}>
              Approve
            </button>
            <button disabled={busy} onClick={onReject}>
              Reject
            </button>
          </>
        )}

        {role === "admin" &&
          !["pending_approval", "out_for_delivery"].includes(order.status) && (
            <button className="ghost-danger" disabled={busy} onClick={onCancel}>
              Cancel
            </button>
          )}

        {role === "kitchen" && order.status === "preparing" && (
          <button className="primary-button" disabled={busy} onClick={onAdvance}>
            {board.advanceLabel}
          </button>
        )}

        {role === "rider" && order.status === "ready" && !order.riderId && (
          <button className="primary-button" disabled={busy} onClick={onClaim}>
            Claim this delivery
          </button>
        )}

        {role === "rider" && order.status === "ready" && isMine && (
          <button
            className="primary-button"
            disabled={busy}
            onClick={onPickUp}
          >
            Pick up
          </button>
        )}

        {role === "rider" && order.status === "out_for_delivery" && isMine && (
          <button className="primary-button" disabled={busy} onClick={onDeliver}>
            Mark delivered
          </button>
        )}
      </div>
    </article>
  );
}
