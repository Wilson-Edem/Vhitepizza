import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import "./checkout.css";

const formatMoney = (value) =>
  `₦${Number(value || 0).toLocaleString("en-NG")}`;

const toOrderItem = (item) => ({
  productId: item.productId,
  sizeId: item.sizeId,
  quantity: item.quantity,
  crustId: item.crustId ?? null,
  cheeseId: item.cheeseId ?? null,
  extraToppingIds: item.extraToppingIds || [],
  removedToppingIds: item.removedToppingIds || [],
});

const STEPS = [
  ["address", "Address"],
  ["review", "Review"],
  ["payment", "Payment"],
];

export default function CheckoutView({
  user,
  cart,
  deliveryAddress,
  onPickAddress,
  onBack,
  onToast,
}) {
  const [step, setStep] = useState("address");
  const [quote, setQuote] = useState(null);
  const [loadingQuote, setLoadingQuote] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const cartItems = useMemo(() => cart.map(toOrderItem), [cart]);

  useEffect(() => {
    let active = true;

    if (!user || !cart.length) {
      setQuote(null);
      setLoadingQuote(false);
      return undefined;
    }

    setLoadingQuote(true);

    apiFetch("/quote", {
      method: "POST",
      body: { items: cartItems },
    })
      .then((result) => {
        if (active) setQuote(result);
      })
      .catch((error) => {
        if (active) onToast(error.message);
      })
      .finally(() => {
        if (active) setLoadingQuote(false);
      });

    return () => {
      active = false;
    };
  }, [user, cartItems, cart.length, onToast]);

  const continueFromAddress = () => {
    if (!deliveryAddress) {
      onToast("Choose a delivery address first.");
      return;
    }

    setStep("review");
  };

  const continueFromReview = () => {
    if (!quote) {
      onToast("Your server price is still loading.");
      return;
    }

    setStep("payment");
  };

  const payNow = async () => {
    if (!deliveryAddress) {
      onToast("Choose a delivery address first.");
      setStep("address");
      return;
    }

    setSubmitting(true);

    try {
      const order = await apiFetch("/orders", {
        method: "POST",
        body: {
          items: cartItems,
          address: deliveryAddress,
        },
      });

      const payment = await apiFetch(
        `/orders/${encodeURIComponent(order.id)}/payment/initialize`,
        { method: "POST" }
      );

     if (!payment.authorizationUrl) {
  throw new Error("Paystack did not return a checkout URL.");
}

localStorage.setItem(
  "vhitepizza-pending-order-id",
  order.id
);

localStorage.setItem(
  "vhitepizza-pending-payment-reference",
  payment.reference || ""
);


      window.location.assign(payment.authorizationUrl);
    } catch (error) {
      onToast(error.message);
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="page-content checkout-page">
        <section className="checkout-empty">
          <CreditCard size={34} />
          <h2>Sign in to continue</h2>
          <p>Your account is required before we can create the order.</p>
        </section>
      </div>
    );
  }

  if (!cart.length) {
    return (
      <div className="page-content checkout-page">
        <section className="checkout-empty">
          <CreditCard size={34} />
          <h2>Your cart is empty</h2>
          <p>Add some items before opening checkout.</p>
          <button className="primary-button" onClick={onBack}>
            Back to Menu
          </button>
        </section>
      </div>
    );
  }

  const currentIndex = Math.max(0, STEPS.findIndex(([id]) => id === step));

  return (
    <div className="page-content checkout-page">
      <div className="checkout-heading">
        <button className="checkout-back" onClick={onBack} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <div>
          <span>CHECKOUT</span>
          <h2>Complete your order</h2>
        </div>
      </div>

      <div className="checkout-steps">
        {STEPS.map(([id, label], index) => (
          <div
            className={`checkout-step ${
              index < currentIndex ? "done" : index === currentIndex ? "active" : ""
            }`}
            key={id}
          >
            <span>{index < currentIndex ? <Check size={14} /> : index + 1}</span>
            <strong>{label}</strong>
          </div>
        ))}
      </div>

      {step === "address" && (
        <section className="checkout-card">
          <div className="checkout-card-heading">
            <div>
              <span>STEP 1</span>
              <h3>Delivery address</h3>
            </div>
            <MapPin size={22} />
          </div>

          {deliveryAddress ? (
            <div className="address-preview">
              <strong>{deliveryAddress.formattedAddress}</strong>
              <span>{deliveryAddress.phone}</span>
              {deliveryAddress.landmark && <span>Landmark: {deliveryAddress.landmark}</span>}
              {deliveryAddress.notes && <span>Notes: {deliveryAddress.notes}</span>}
            </div>
          ) : (
            <div className="address-empty">
              <MapPin size={28} />
              <p>No delivery address selected.</p>
            </div>
          )}

          <button className="secondary-button" onClick={onPickAddress}>
            {deliveryAddress ? "Change Delivery Location" : "Choose Delivery Location"}
          </button>

          <button className="primary-button" onClick={continueFromAddress}>
            Continue to Review
            <ArrowRight size={17} />
          </button>
        </section>
      )}

      {step === "review" && (
        <section className="checkout-card">
          <div className="checkout-card-heading">
            <div>
              <span>STEP 2</span>
              <h3>Review your order</h3>
            </div>
            <ShieldCheck size={22} />
          </div>

          <div className="checkout-lines">
            {cart.map((item) => (
              <div className="checkout-line" key={item.id}>
                <div>
                  <strong>{item.quantity} × {item.name}</strong>
                  <small>
                    {item.sizeLabel}
                    {item.details?.length ? ` · ${item.details.join(" · ")}` : ""}
                  </small>
                </div>
                <strong>{formatMoney((item.price || 0) * item.quantity)}</strong>
              </div>
            ))}
          </div>

          {loadingQuote ? (
            <div className="quote-loading">Checking the server price…</div>
          ) : quote ? (
            <div className="checkout-total-box">
              <div><span>Subtotal</span><strong>{formatMoney(quote.subtotal)}</strong></div>
              <div><span>Delivery fee</span><strong>{formatMoney(quote.deliveryFee)}</strong></div>
              <div className="grand"><span>Total</span><strong>{formatMoney(quote.total)}</strong></div>
            </div>
          ) : (
            <div className="quote-loading">We could not get the current server total.</div>
          )}

          <div className="checkout-address-mini">
            <MapPin size={18} />
            <span>{deliveryAddress?.formattedAddress}</span>
            <button onClick={() => setStep("address")}>Change</button>
          </div>

          <div className="checkout-actions">
            <button className="secondary-button" onClick={() => setStep("address")}>Back</button>
            <button className="primary-button" onClick={continueFromReview}>
              Continue to Payment
              <ArrowRight size={17} />
            </button>
          </div>
        </section>
      )}

      {step === "payment" && (
        <section className="checkout-card">
          <div className="checkout-card-heading">
            <div>
              <span>STEP 3</span>
              <h3>Secure payment</h3>
            </div>
            <CreditCard size={22} />
          </div>

          <div className="payment-summary">
            <p>
              You will be redirected to Paystack to complete the payment securely.
            </p>
            <div><span>Amount to pay</span><strong>{formatMoney(quote?.total)}</strong></div>
          </div>

          <div className="payment-note">
            <ShieldCheck size={17} />
            <span>
              Vhite Pizza verifies the transaction on the server before the order
              moves into the kitchen workflow.
            </span>
          </div>

          <div className="checkout-actions">
            <button className="secondary-button" disabled={submitting} onClick={() => setStep("review")}>Back</button>
            <button className="primary-button" disabled={submitting || !quote} onClick={payNow}>
              {submitting ? "Opening Paystack…" : "Pay with Paystack"}
              {!submitting && <ArrowRight size={17} />}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
