# Vhitepizza: Phase 1 Foundations

Status: planning only. No application code yet. Items marked **PROPOSED** are my suggestions and need your confirmation.

---

## 1. Decisions so far

- **Product:** Vhitepizza, a real restaurant's pizza delivery platform for Nigeria. Prices in whole Naira (₦).
- **Stack:** React + Vite + Tailwind (web, hosted on Vercel), Firebase Auth / Firestore / Storage, Node.js + Express server (write logic, pricing, payments, emails).
- **Customers:** must sign in (Google, email + password, phone number with SMS for recovery). Customer updates are in-app only.
- **Staff:** three roles. Admin (controls everything), Kitchen (sees orders, Ready button), Rider (sees ready orders, customer location; can claim an order or be assigned one).
- **Delivery:** one flat fee for everyone, no area limit (optional max distance in admin Settings).
- **Payments:** Paystack in Naira (test mode while building). The server starts and verifies every transaction; amounts are sent in kobo.
- **Confirmation:** automatic for normal orders; large orders need admin approval. Customers pay upfront; rejected or cancelled paid orders are refunded (v1: admin processes refunds in the payment dashboard).
- **Cancellation:** customers can cancel until the order moves to Preparing, which happens automatically after confirmation.
- **Alerts:** urgent (large) orders trigger an email to the restaurant; everything else uses dashboard sound + badge.
- **Location:** a map picker built into Vhitepizza (Leaflet with Geoapify map tiles): current location, address search, draggable pin, or manual entry (address, phone, landmark, notes). VhiteMap stays a separate app; Vhitepizza only links to it so a customer can view their exact live location. No data flows between the two.
- **Theme:** dark or light, chosen in Settings.
- **Images:** menu and topping images live in `web/public/images` in the repo. Firebase Storage needs a paid plan, so it is not used in v1.
- **Email:** Web3Forms sends urgent-order alerts to the restaurant.
- **Restaurant location:** set from the admin's phone GPS in Settings, not hard-coded.
- **Not in v1:** phone-in orders, dashboard charts, promo codes, ratings, live rider tracking, admin image uploads.

---

## 2. Menu file review

The menu JSON has 4 categories, 14 products (5 pizzas, 4 sides, 2 desserts, 3 drinks) and shared options (3 crusts, 3 cheeses, 13 toppings). Every default topping id and every category reference resolves correctly. Issues to fix before seeding:

1. **Defaults mix option types.** `defaultToppings` contains cheese ids (`mozzarella`, `extra-cheese`) and sauce ids (`bbq-sauce`, `tomato-sauce`) alongside toppings. Fix: give each pizza a `defaultCheese` field and keep `defaultToppings` for topping ids only.
2. **Veggie Overload has no cheese.** Its description says mozzarella but it isn't listed. `defaultCheese: mozzarella` fixes it.
3. **Pepperoni Supreme already includes extra cheese** in its price (default). The cheese surcharge must not be charged again for it (see pricing rules).
4. **Chicken Suya Pizza mentions a "signature pepper sauce"** that doesn't exist in options. Either add it as a sauce or remove it from the description.
5. **Sauces exist only as ₦300 extras.** There is no base-sauce choice. Assumed: each pizza's base sauce is included; sauces in the options list are add-ons.
6. **Add a `sizes` list** (id, label, optional inches) so the UI can show "Small", "Medium", "Large". Non-pizza items use `regular`.
7. **Rename one id.** `spicy-chicken-wings-6pcs` is called "Spicy Suya Wings". Ids are stored in orders forever, so rename it (for example `suya-wings-6pcs`) now.
8. **Images:** 14 product images + 13 topping images = 27 filenames that must exactly match your files.
9. **File type:** save the menu as `menu.json` (it was uploaded as `.md`).

Proposed default cheese/topping mapping:

| Pizza | defaultCheese | defaultToppings |
|---|---|---|
| chicken-suya-pizza | mozzarella | chicken-suya, green-pepper, red-onions |
| bbq-chicken-pizza | mozzarella | grilled-chicken, bbq-sauce, red-onions |
| pepperoni-supreme | extra-cheese | beef-pepperoni, tomato-sauce |
| veggie-overload | mozzarella | mushrooms, green-pepper, sweet-corn, black-olives, red-onions |
| naija-fiesta-pizza | mozzarella | minced-beef, beef-sausage, chicken-suya, scotch-bonnet |

Sides, desserts and drinks have no options, so they get a quick "Add" button. Only pizzas get "Customize".

---

## 3. Pricing rules (server is the only source of truth) **PROPOSED**

1. Base price = the product's price for the chosen size.
2. Crust = the crust's extra price (flat across sizes, as in your file).
3. Cheese = the chosen cheese's extra price minus the extra price of the pizza's `defaultCheese`. For most pizzas the default is regular mozzarella (₦0), so it is just the extra price. Pepperoni Supreme's default is Extra Mozzarella (₦1,000), so choosing standard mozzarella lowers the price by ₦1,000 and cheddar adds ₦200. **PROPOSED**, so cheese follows the same logic as toppings.
4. Toppings and sauces = each selected item that is not a default costs its listed price.
5. **Removing a default topping reduces the price by that topping's listed price** (confirmed).
6. Each topping can be added once (no double portions in v1).
7. Line total = unit price × quantity. Subtotal = sum of lines. Total = subtotal + flat delivery fee.
8. Sides, desserts and drinks = regular price × quantity.

Worked example: Chicken Suya Pizza, Large ₦9,500 + Cheese-Stuffed Crust ₦1,500 + Extra Mozzarella ₦1,000 + Mushrooms ₦700 − Red Onions removed ₦400 = ₦12,300 each. Two of them = ₦24,600, plus the flat delivery fee.

The web app shows a live preview using the same rules, but the server recalculates everything from Firestore menu data at checkout and ignores any price sent by the browser.

---

## 4. Firestore data model

All money fields are integers in Naira. All timestamps are server timestamps. Clients never write orders directly.

### users/{uid}
displayName, email, phone, photoURL, role (customer | admin | kitchen | rider; the real source of truth is the Firebase custom claim, this is a mirror for display), active (staff can be disabled), themePreference, createdAt.

### users/{uid}/addresses/{addressId}
label (Home, Work), formattedAddress, lat, lng, phone, landmark, notes, isDefault, source (pin | search | manual).

### categories/{categoryId}
name, description, order, active.

### products/{productId}
name, description, categoryId, image, available, type (pizza | simple), prices (map of sizeId to Naira), defaultCheeseId (pizzas), defaultToppingIds (pizzas), sortOrder, createdAt, updatedAt.

### crusts/{id}, cheeses/{id}
name, extraPrice, available, sortOrder.

### toppings/{id}
name, group (meat | vegetable | sauce), price, image, available, sortOrder.

### settings/public (readable by everyone)
storeName, isOpen (manual override), openingHours (per weekday), flatDeliveryFee, cancelGraceMinutes (0 = none), sizes (id, label, inches), maxDist (delivery limit in km), restaurantLocation (lat, lng, address; set from the admin's phone), contactPhone, currency (NGN).

### settings/private (admin only)
largeOrderThresholds (minimum total and/or item count), approvalReminderMinutes, urgentEmailRecipients.

### orders/{orderId}
- orderNumber (readable, for example VP-1042, from a counter)
- customerId, customer snapshot (name, phone, email)
- items[]: productId, name snapshot, size, quantity, crustId, cheeseId, extraToppingIds, removedToppingIds, unitPrice, lineTotal, note
- address snapshot: formattedAddress, lat, lng, phone, landmark, notes, source
- pricing: subtotal, deliveryFee, total
- status, statusHistory[] (status, at, byUid, byRole, note)
- requiresApproval, approval (state: pending | approved | rejected, byUid, at, reason)
- payment: provider (paystack), reference, status (pending | paid | failed | refund_pending | refunded), paidAt
- riderId, riderAssignedBy (admin | self)
- cancelledBy, cancelReason
- timestamps: createdAt, placedAt, confirmedAt, preparingAt, readyAt, pickedUpAt, deliveredAt, cancelledAt

### counters/orders
Used by the server only, in a transaction, to produce order numbers.

---

## 5. Order lifecycle

Statuses: awaiting_payment, placed, pending_approval, confirmed, preparing, ready, out_for_delivery, delivered, cancelled.

| From | To | Who triggers it |
|---|---|---|
| (new) | awaiting_payment | Server, when the customer starts checkout |
| awaiting_payment | placed | Server, after payment is verified |
| placed | confirmed | Server automatically (normal order) |
| placed | pending_approval | Server automatically (large order) |
| pending_approval | confirmed | Admin (approve) |
| pending_approval | cancelled | Admin (reject, reason required) |
| confirmed | preparing | Server automatically (after an optional grace period, see section 8) |
| preparing | ready | Kitchen ("Ready" button) |
| ready | out_for_delivery | Rider (claims or picks up assigned order) |
| out_for_delivery | delivered | Rider |
| placed, pending_approval, confirmed | cancelled | Customer (until preparing) |
| any state before delivered | cancelled | Admin (reason required) |

When a paid order is cancelled, payment status becomes `refund_pending` until the admin marks the refund done.

Preparing starts automatically after confirmation, so the customer's cancel window closes at that moment. Without a grace period that is almost immediately after payment for normal orders (see section 8).

---

## 6. Server API (all under /api/v1, JSON, Firebase ID token required unless stated)

**Customer**
- POST /quote: returns the server-calculated totals for a cart
- POST /orders: create an order (awaiting_payment) and start the payment
- POST /orders/:id/payment/verify: verify the payment and move the order forward
- POST /orders/:id/cancel: customer cancellation (only allowed states)
- Geocoding endpoints: not in v1. The browser calls Geoapify directly with a domain-restricted key. The server still checks that the delivery pin is within `maxDist` of the restaurant when an order is created.
- POST /webhooks/payments: payment provider webhook (no token, verified by signature) so a paid order is still recorded if the customer closes the browser

Customers read their own orders, the menu and their addresses directly from Firestore under security rules.

**Staff**
- PATCH /orders/:id/status: move an order forward (checked against the lifecycle table and the caller's role)
- POST /orders/:id/assign-rider (admin)
- POST /orders/:id/approve and /reject (admin)
- POST /orders/:id/refund-done (admin)

**Admin**
- Menu CRUD: products, categories, crusts, cheeses, toppings, plus availability toggles
- Staff accounts: create, set role, disable
- Settings: read and update
- Stats: today's orders, revenue, pending orders

**System**
- GET /health
- A scheduled check on the server that emails the restaurant when a large order has waited too long for approval, and that moves confirmed orders to Preparing once any cancel grace period has passed

---

## 7. Security rules summary (Firestore and Storage)

- Menu collections and `settings/public`: anyone can read; no client writes.
- `settings/private`: admin only.
- `users/{uid}` and addresses: the owner reads and writes their own (never their own role).
- `orders`: customers read their own only; staff read by role; **no client writes at all**. Every change goes through the Node server (Admin SDK), which enforces the lifecycle.
- Storage: not used in v1 (images live in the repo under `web/public/images`).
- Staff roles are Firebase custom claims set only by the server or the first-admin script.

Known v1 tradeoff: kitchen staff can read full order documents, including the customer's address and phone. Firestore can't hide single fields by role. Acceptable for trusted staff.

---

## 8. Open decisions

1. Cancel window (**PROPOSED**): a grace period of 3 minutes (adjustable in Settings, 0 = none) between Confirmed and Preparing. The kitchen only sees an order once it reaches Preparing, so no food is made during the grace period. The customer sees a countdown on the tracking page and can cancel until it ends. Large orders stay cancellable while they wait for approval.
2. Cheese pricing rule (section 3, rule 3): confirm it works like toppings, as the difference from the pizza's default cheese.
3. Flat delivery fee amount, large-order threshold, opening hours (settings, not blockers).
4. Payment gateway: **Paystack** (decided). Still to confirm with the client: which methods to enable (card, bank transfer, USSD) and whether pay-on-delivery is offered.
5. Email service: Web3Forms.
6. Restaurant name, logo and address for the brand and receipts.

---

## 9. Accounts and setup checklist (your tasks before any code)

**Firebase**
1. Create a project (for example `vhite-pizza`).
2. Add a Web app and keep the config values (they go in the web `.env`).
3. Enable Authentication providers: Email/Password, Google, Phone.
4. Create the Firestore database. Pick the closest available region to Lagos; the region cannot be changed later.
5. Storage: skipped in v1 because it needs a paid plan. If you upgrade later, set a billing budget alert (phone sign-in SMS can also cost money).
6. Generate a service account key for the Node server. Never commit it to Git.

**Geoapify**
1. Create an account and a project.
2. Use one API key for the Vhitepizza web app (map tiles, address search and reverse lookup all run in the browser). Restrict it to allowed origins: `http://localhost:5173` and the Vercel domain.
3. Watch daily usage in the Geoapify dashboard. The key is visible in the browser, so origin limits reduce misuse but do not fully prevent it.

**Paystack** (replaces Razorpay, which does not serve Nigerian businesses)
1. Sign up at Paystack and use test mode while building.
2. Under Settings → API Keys & Webhooks, copy the test public key and test secret key. The secret key goes only in the Node server's `.env` as `PAYSTACK_SECRET_KEY`. No separate webhook secret is needed, because Paystack signs webhooks with the secret key. The public key (`VITE_PAYSTACK_PUBLIC_KEY` in `web/.env`) is only needed if we use Paystack's popup checkout instead of redirecting to Paystack's payment page.
3. The restaurant completes Paystack's business verification later to switch to live keys.

**Email**
1. Email service: Web3Forms (access key created). Check its free-plan limits when we build the alerts.

**GitHub**
1. Create a private `vhite-pizza` repository. VhiteMap stays as its own repository.

**Secrets rule:** every key lives in `.env` files that are git-ignored, with an `.env.example` listing the variable names only.

---

## 10. What comes next

- Phase 2: create the repo and workspaces, install dependencies, configure Firebase and Tailwind, build the app shell and theme (this is where code begins, only when you say go).
