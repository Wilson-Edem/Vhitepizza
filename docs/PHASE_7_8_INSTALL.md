# Vhite Pizza — Phase 7 & 8 package

This package is designed for the current `Wilson-Edem/Vhitepizza` repository.

## Included files and exact destinations

### API — replace existing files

- `api/src/index.js`
- `api/src/routes/orders.js`
- `api/src/services/orders.js`
- `api/src/services/menu.js`
- `api/.env.example`

### API — add new files

- `api/src/routes/paymentWebhook.js`
- `api/src/services/payments/paystack.js`

### Web — replace existing files

- `web/src/features/customize/CustomizeSheet.jsx`
- `web/src/features/customize/customize.css`

### Web — add new files

- `web/src/features/checkout/CheckoutView.jsx`
- `web/src/features/checkout/checkout.css`
- `web/src/features/orders/OrdersView.jsx`
- `web/src/features/orders/order.css`

### Web — integration

- `APP_PHASE_7_8_PATCH.ps1` patches your existing `web/src/App.jsx` in place.

Put the package contents at your project root:

`C:\Users\Dev\Vhitepizza`

Then run `APP_PHASE_7_8_PATCH.ps1` from that root.

## What the update does

### Customize

You can select multiple extra toppings from different groups. The UI now presents toppings in a wrapping grid, shows the number of choices in each group, shows selected extras, and increases contrast for the option labels and supporting text.

### Delivery fee

The frontend no longer owns a separate hardcoded delivery-fee value. The API menu payload now exposes `settings/public.flatDeliveryFee`; the cart displays that value, while `/quote` and order creation continue to use the server setting as the authoritative value.

### Phase 7 — Paystack

The customer flow is:

1. Checkout asks the server for the current price.
2. The server creates the order as `awaiting_payment`.
3. The server initializes Paystack.
4. The browser redirects to Paystack Checkout.
5. Paystack returns the browser to the Vhite Pizza callback URL.
6. The browser sends the returned payment reference to `/orders/:id/payment/verify`.
7. The server calls Paystack's verify endpoint and checks status, reference, currency and exact amount.
8. The verified order then continues through the existing order lifecycle.
9. The public webhook also verifies the Paystack signature and the transaction before using the same idempotent payment logic.

Paystack documents backend initialization with a secret key, amounts in the currency subunit, redirect callback URLs, and server-side verification.

### Phase 8 — Orders

Customers can view order history, open an order, see the payment state, delivery address, item totals, status tracker and status history, and cancel eligible orders. Order details refresh while open.

### Late-payment protection

If an unpaid order is cancelled and a successful payment arrives afterwards, the order remains cancelled and the payment becomes `refund_pending`. The existing admin refund-completion path remains the source of truth for the manual refund in v1.

## Install steps

### 1. Back up the project

Before replacing files, make one copy of:

`C:\Users\Dev\Vhitepizza`

### 2. Copy the package files

Copy the API and web files into the exact paths above.

Do not delete your existing Firebase service account, images, menu seed data, auth files or Phase 5/6 location files.

### 3. Patch App.jsx

Open PowerShell in:

`C:\Users\Dev\Vhitepizza`

Run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\APP_PHASE_7_8_PATCH.ps1
```

The script edits only `web/src/App.jsx`.

### 4. Configure Paystack test mode

Open:

`C:\Users\Dev\Vhitepizza\api\.env`

Keep your existing Firebase values and add:

```env
WEB_URL=http://localhost:5173
PAYSTACK_SECRET_KEY=sk_test_your_test_secret_key
PAYSTACK_CALLBACK_URL=
```

Do not put the secret key in React or `web/.env`.

Paystack's documentation states that secret keys belong on the server and that Test Mode transactions do not involve real money.

### 5. Install / start

From the repository root:

```powershell
npm install
npm run dev --workspace api
```

In a second terminal:

```powershell
npm run dev --workspace web
```

### 6. Configure the webhook when the API is publicly reachable

Use:

`https://YOUR_API_DOMAIN/api/v1/payments/webhook`

Do not use localhost as the Paystack webhook URL.

Paystack signs webhook payloads with `x-paystack-signature` using HMAC-SHA512; this package captures the raw request bytes and validates that signature before processing the event.

### 7. Test

Use this order:

1. Sign in.
2. Add a pizza.
3. Open **Customize**.
4. Pick more than one extra topping, including toppings from different groups.
5. Add it to the cart.
6. Confirm the displayed delivery fee matches the value in `settings/public.flatDeliveryFee`.
7. Open Checkout.
8. Confirm the server subtotal, delivery fee and total.
9. Continue to Paystack Test Mode.
10. Complete a test transaction.
11. Return to Vhite Pizza.
12. Open Orders and open the new order.
13. Confirm the status tracker and payment state.

Paystack publishes reusable successful test cards and other channel test data on its official test-payment page.

## Important Firestore setting

Keep this field in:

`settings/public`

```text
flatDeliveryFee
```

For example, if it is `1500`, the cart, quote and order all use ₦1,500 as the delivery fee.

## No new npm package

Your current API already has Axios, so this phase does not require another dependency for Paystack HTTP calls.
