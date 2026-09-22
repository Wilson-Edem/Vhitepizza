import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { apiFetch } from "../../lib/api";

const ORDER_KEY = "vhitepizza-pending-order-id";
const REF_KEY = "vhitepizza-pending-payment-reference";

// Landing here means the customer just came back from Paystack. The order
// already exists on the server (it was created before the redirect), so
// this screen doesn't need its own tracking UI: it confirms the payment in
// the background and sends the customer straight to that order's normal
// detail/tracking page, the same one they'd reach from Order History.
export default function PaymentReturnView({ user, onNavigate, onClearCart }) {
  useEffect(() => {
    if (!user) {
      onNavigate?.("auth");
      return;
    }

    const orderId = localStorage.getItem(ORDER_KEY);
    const reference = localStorage.getItem(REF_KEY);

    if (!orderId) {
      // No pending payment on this device; just go to the order list.
      onNavigate?.("orders");
      return;
    }

    // The items are already committed to this order on the server, so the
    // cart is cleared right away rather than waiting on payment status.
    onClearCart?.();
    localStorage.removeItem(ORDER_KEY);
    localStorage.removeItem(REF_KEY);

    // Confirms with Paystack directly instead of only waiting for the
    // webhook (which needs a reachable server URL). Fire-and-forget: the
    // order page we redirect to polls on its own and will show the result
    // whether this finishes first or the webhook does.
    if (reference) {
      apiFetch(`/orders/${encodeURIComponent(orderId)}/payment/verify`, {
        method: "POST",
        body: { reference },
      }).catch(() => {});
    }

    onNavigate?.("orders", orderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="state-box">
      <Loader2 className="spin" size={36} />
      <p>Taking you to your order...</p>
    </div>
  );
}
