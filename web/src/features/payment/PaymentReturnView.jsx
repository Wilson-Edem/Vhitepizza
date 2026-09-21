import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, Loader2, XCircle } from "lucide-react";
import { apiFetch } from "../../lib/api";

const ORDER_KEY = "vhitepizza-pending-order-id";
const REF_KEY = "vhitepizza-pending-payment-reference";

const LABELS = {
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

const TRACKING = [
  "placed",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
];

export default function PaymentReturnView({ user, onNavigate, onClearCart }) {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stopped = false;
    let timer;

    if (!user) {
      onNavigate?.("auth");
      return undefined;
    }

    const orderId = localStorage.getItem(ORDER_KEY);

    // Direct visits to /payment/return do not verify or settle payments.
    if (!orderId) {
      setError("No pending payment session was found on this device.");
      return undefined;
    }

    const load = async () => {
      try {
        const result = await apiFetch(
          `/orders/${encodeURIComponent(orderId)}`
        );

        if (stopped) return;

        const data = result?.data ?? result;
        setOrder(data);
        setError("");

        // Cart is cleared only after the server says the payment is paid.
        if (data?.payment?.status === "paid") {
          onClearCart?.();
          localStorage.removeItem(ORDER_KEY);
          localStorage.removeItem(REF_KEY);
          return;
        }

        timer = window.setTimeout(load, 3000);
      } catch (err) {
        if (!stopped) {
          setError(err?.message || "Could not load the order.");
          timer = window.setTimeout(load, 5000);
        }
      }
    };

    load();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [user, onNavigate, onClearCart]);

  if (!user) return null;

  if (error && !order) {
    return (
      <div className="page-content orders-page">
        <div className="order-state">
          <XCircle size={36} />
          <h2>Payment return</h2>
          <p>{error}</p>
          <button
            className="primary-button"
            onClick={() => onNavigate?.("orders")}
          >
            View my orders
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="page-content orders-page">
        <div className="order-state">
          <Loader2 className="spin" size={36} />
          <h2>Checking your payment</h2>
          <p>Loading your order status…</p>
        </div>
      </div>
    );
  }

  const paid = order.payment?.status === "paid";
  const index = TRACKING.indexOf(order.status);

  return (
    <div className="page-content orders-page">
      <div className="order-detail-card">
        <div className="order-detail-top">
          <div>
            <span>{order.orderNumber}</span>
            <h3>
              {paid ? "Payment confirmed" : "Payment being confirmed"}
            </h3>
          </div>

          <strong>
            ₦{Number(order.pricing?.total || 0).toLocaleString("en-NG")}
          </strong>
        </div>

        {!paid && (
          <div className="order-state">
            <Clock3 size={28} />
            <p>
              Your payment return was received. Vhite Pizza is waiting for the
              signed Paystack webhook to confirm the transaction. This page
              updates automatically.
            </p>
          </div>
        )}

        {paid && (
          <div className="order-state">
            <CheckCircle2 size={30} />
            <p>
              Payment confirmed. Your order is now in the live order workflow.
            </p>
          </div>
        )}

        <div className="order-tracker">
          {TRACKING.map((status, i) => (
            <div
              className={`order-step ${i <= index ? "active" : ""}`}
              key={status}
            >
              <span>{i + 1}</span>
              <div>
                <strong>{LABELS[status]}</strong>
                {i === index && <small>Current status</small>}
              </div>
            </div>
          ))}
        </div>

        <div className="order-address">
          <strong>Delivery address</strong>
          <p>{order.address?.formattedAddress}</p>
        </div>

        <div className="payment-status-row">
          <span>Payment</span>
          <strong>{order.payment?.status || "pending"}</strong>
        </div>

        <button
          className="primary-button"
          onClick={() => onNavigate?.("orders")}
        >
          View order details
        </button>
      </div>
    </div>
  );
}
