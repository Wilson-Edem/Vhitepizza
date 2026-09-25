import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Clock3, MapPin, PackageCheck, RefreshCw, XCircle } from "lucide-react";
import { apiFetch } from "../../lib/api";
import CustomerDeliveryMap from "./CustomerDeliveryMap";
import "./order.css";

const formatMoney = (value) => `₦${Number(value || 0).toLocaleString("en-NG")}`;

const STATUS_LABELS = {
  awaiting_payment: "Awaiting payment",
  placed: "Order placed",
  pending_approval: "Awaiting approval",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const TRACKING_STATUSES = ["placed", "confirmed", "preparing", "ready", "out_for_delivery", "delivered"];
const CANCELLABLE = new Set(["awaiting_payment", "placed", "pending_approval", "confirmed"]);

const formatDate = (value) => {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
};

const statusText = (status) => STATUS_LABELS[status] || status;

export default function OrdersView({ user, onToast, onSignIn, initialOrderId, onConsumedInitial }) {
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  const loadOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setOrders(await apiFetch("/orders/mine"));
    } catch (error) {
      onToast(error.message);
    } finally {
      setLoading(false);
    }
  }, [user, onToast]);

  const loadDetail = useCallback(async (id) => {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      setSelected(await apiFetch(`/orders/${encodeURIComponent(id)}`));
    } catch (error) {
      onToast(error.message);
    } finally {
      setDetailLoading(false);
    }
  }, [onToast]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    if (!initialOrderId) return;
    loadDetail(initialOrderId);
    onConsumedInitial?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrderId]);

  // Keep an active order fresh so the customer sees the rider location that
  // the rider publishes from the active-delivery screen.
  useEffect(() => {
    if (!selectedId) return undefined;
    const timer = setInterval(() => loadDetail(selectedId), 15000);
    return () => clearInterval(timer);
  }, [selectedId, loadDetail]);

  const cancelOrder = async () => {
    if (!selected) return;
    setCancelling(true);
    try {
      await apiFetch(`/orders/${encodeURIComponent(selected.id)}/cancel`, {
        method: "POST",
        body: { reason },
      });
      onToast("Order cancelled.");
      setReason("");
      await loadDetail(selected.id);
      await loadOrders();
    } catch (error) {
      onToast(error.message);
    } finally {
      setCancelling(false);
    }
  };

  if (!user) {
    return (
      <div className="page-content orders-page">
        <div className="order-state">
          <PackageCheck size={34} />
          <h2>Sign in to view your orders</h2>
          <p>Your order history is tied to your Vhitepizza account.</p>
          <button className="primary-button" onClick={onSignIn}>Sign In</button>
        </div>
      </div>
    );
  }

  const tracking = (status) => {
    if (status === "cancelled") {
      return (
        <div className="order-cancelled-box">
          <XCircle size={22} />
          <div>
            <strong>Order cancelled</strong>
            <p>{selected?.cancelReason || "This order will not continue."}</p>
          </div>
        </div>
      );
    }

    const activeIndex = Math.max(0, TRACKING_STATUSES.indexOf(status));
    return (
      <div className="order-tracker">
        {TRACKING_STATUSES.map((item, index) => (
          <div className={`order-step ${index < activeIndex ? "done" : index === activeIndex ? "active" : ""}`} key={item}>
            <span>{index < activeIndex ? <PackageCheck size={13} /> : index + 1}</span>
            <div>
              <strong>{statusText(item)}</strong>
              {index === activeIndex && <small>Current status</small>}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (selectedId) {
    const rider = selected?.delivery?.riderLocation || null;
    const isDelivery = selected?.status === "out_for_delivery";

    return (
      <div className="page-content orders-page">
        <div className="page-header">
          <button onClick={() => setSelectedId(null)} aria-label="Back to orders"><ArrowLeft size={20} /></button>
          <h2>{selected?.orderNumber || "Order details"}</h2>
          <button onClick={() => loadDetail(selectedId)} aria-label="Refresh order"><RefreshCw size={18} /></button>
        </div>

        {detailLoading && !selected ? (
          <div className="order-state"><Clock3 size={30} /><p>Loading order details…</p></div>
        ) : selected ? (
          <>
            <section className="order-detail-card">
              <div className="order-detail-top">
                <div><span>{formatDate(selected.createdAt)}</span><h3>{statusText(selected.status)}</h3></div>
                <strong>{formatMoney(selected.pricing?.total)}</strong>
              </div>
              {tracking(selected.status)}
              <div className="order-address">
                <MapPin size={18} />
                <div><strong>Delivery address</strong><p>{selected.address?.formattedAddress}</p></div>
              </div>
            </section>

            {isDelivery && (
              <section className="order-detail-card customer-tracking-card">
                <div className="order-tracking-heading">
                  <div><span>LIVE DELIVERY</span><h3>Track your rider</h3></div>
                  <small>{rider ? "Location updates automatically" : "Waiting for rider location"}</small>
                </div>
                <CustomerDeliveryMap
                  dark={false}
                  customer={selected.address}
                  rider={rider}
                />
              </section>
            )}

            <section className="order-detail-card">
              <h3>Items</h3>
              <div className="order-item-list">
                {(selected.items || []).map((item, index) => (
                  <div className="order-history-item" key={`${item.productId}-${index}`}>
                    <div>
                      <strong>{item.quantity} × {item.name}</strong>
                      <small>{item.sizeLabel}{item.details?.length ? ` · ${item.details.join(" · ")}` : ""}</small>
                    </div>
                    <strong>{formatMoney(item.lineTotal)}</strong>
                  </div>
                ))}
              </div>
              <div className="order-total-list">
                <div><span>Subtotal</span><strong>{formatMoney(selected.pricing?.subtotal)}</strong></div>
                <div><span>Delivery fee</span><strong>{formatMoney(selected.pricing?.deliveryFee)}</strong></div>
                <div className="grand"><span>Total</span><strong>{formatMoney(selected.pricing?.total)}</strong></div>
              </div>
            </section>

            <section className="order-detail-card">
              <h3>Payment</h3>
              <div className="payment-status-row"><span>Status</span><strong>{selected.payment?.status || "pending"}</strong></div>
              {selected.payment?.reference && <div className="payment-status-row"><span>Reference</span><strong>{selected.payment.reference}</strong></div>}
              {selected.payment?.status === "refund_pending" && <p className="refund-note">A refund is pending completion by the restaurant.</p>}
            </section>

            {CANCELLABLE.has(selected.status) && (
              <section className="order-detail-card cancel-card">
                <h3>Cancel order</h3>
                <p>Cancellation is available until the order starts preparing.</p>
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason (optional)" rows={3} />
                <button className="danger-button" disabled={cancelling} onClick={cancelOrder}>
                  <XCircle size={17} /> {cancelling ? "Cancelling…" : "Cancel Order"}
                </button>
              </section>
            )}

            <section className="order-detail-card">
              <h3>Status history</h3>
              <div className="status-history">
                {(selected.statusHistory || []).map((entry, index) => (
                  <div className="history-entry" key={`${entry.status}-${index}`}>
                    <span className="history-dot" />
                    <div><strong>{statusText(entry.status)}</strong><small>{formatDate(entry.at)}</small>{entry.note && <p>{entry.note}</p>}</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          <div className="order-state"><p>Order details are unavailable.</p></div>
        )}
      </div>
    );
  }

  return (
    <div className="page-content orders-page">
      <div className="orders-heading-row">
        <div><span>YOUR ORDERS</span><h2>Order History</h2><p>Track payments, preparation and delivery from one place.</p></div>
        <button onClick={loadOrders} aria-label="Refresh orders"><RefreshCw size={18} /></button>
      </div>

      {loading ? (
        <div className="order-state"><Clock3 size={30} /><p>Loading your orders…</p></div>
      ) : orders.length ? (
        <div className="order-list">
          {orders.map((order) => (
            <button className="order-list-card" key={order.id} onClick={() => loadDetail(order.id)}>
              <div className="order-list-main"><span>{order.orderNumber}</span><strong>{statusText(order.status)}</strong><small>{formatDate(order.createdAt)}</small></div>
              <div className="order-list-total"><strong>{formatMoney(order.pricing?.total)}</strong><ArrowLeft size={17} className="order-arrow" /></div>
            </button>
          ))}
        </div>
      ) : (
        <div className="order-state"><PackageCheck size={34} /><h3>No orders yet</h3><p>Once you place an order, it will appear here.</p></div>
      )}
    </div>
  );
}
