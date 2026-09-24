# Vhitepizza v2 Foundations

Status: planning only. No application code yet. Items marked **PROPOSED** are
suggestions and need confirmation. This document assumes v1 is complete and
working (auth, menu, customize, cart, location, checkout/payment, order
tracking, and the admin/kitchen/rider staff dashboards).

---

## 1. What v2 is

v2 is almost entirely **staff and admin-side**. The two exceptions that touch
the client are notification-only (the customer receives emails) and a single
new checkout field (a soft delivery time target) — neither changes anything
else about the customer-facing app.

Goal: make the staff/admin side feel like a real, professional restaurant
delivery platform, not a v1 prototype, so it's ready to demo and, if a
restaurant says yes, rebrand and hand over.

---

## 2. Decisions so far

- **Email provider:** Brevo replaces Web3Forms entirely. Free tier: 300
  emails/day, no credit card required. (Web3Forms was built for simple
  contact-form emails, not a live backend sending programmatic alerts, and
  it doesn't reliably work from a server the way v2 needs.)
- **SMS: skipped.** SMS costs money per message everywhere (roughly ₦5–8 per
  message in Nigeria, or fractions of a cent internationally) — there is no
  free tier for real SMS delivery. Since the restaurant would need to budget
  this ongoing cost, it's cut from v2. Email covers the same "important
  moments" notifications instead. Revisit if a restaurant signs on and wants
  to pay for it.
- **Routing/maps: stays on Geoapify.** Google Maps now requires a linked
  billing account/credit card even for its free tier (the old $200 universal
  credit was retired). Geoapify already has a Routing API, is already
  integrated, and needs no new billing setup.
- **AI agent, deferred to v3, confirmed.**
- **Call + chat bridge:** real call + simple chat in v2; the AI agent that
  would eventually sit in that chat is v3.

---

## 3. Feature list

### 3.1 Staff/admin dashboard rebuild

The current dashboard (Phase 9–11) is functional but was built quickly. v2
replaces it with a proper layout:

- A real sidebar/section navigation per role, not a single flat page with
  tabs bolted on.
- Order lists that are dense and scannable — filters (status, urgency,
  time), search by order number or customer, sortable columns — rather than
  only a Kanban board.
- Clear at-a-glance visual states: new, large/urgent, running long, late
  against the customer's time target.
- **Dedicated "active order" screen** for kitchen and rider: once a kitchen
  order enters Preparing, or a rider claims a Ready order, that person gets
  a focused, full-screen view of just that order (see 3.2 and 3.6) instead
  of staying on the shared board. They can return to the board at any time.
- Admin keeps a board/overview across everything, plus the settings, menu,
  staff and users screens already built in v1.

**PROPOSED** information architecture:

```
Admin:    Overview | Orders | Menu | Staff | Users | Settings
Kitchen:  Queue (board) -> Active Order (on Start)
Rider:    Available (board) -> Active Delivery (on Claim)
```

### 3.2 Dedicated claimed-order screen (kitchen + rider)

- **Kitchen, active order:** every item with full detail (already fixed in
  v1: crust, cheese, added/removed toppings, notes), a single "Ready" action,
  and a **"Flag a problem" action (in scope for v2)** — e.g. out of an
  ingredient. **PROPOSED:** flagging alerts admin (same push-alert channel
  as 3.4) with a short reason, and pauses that order's time-target countdown
  rather than letting it silently run out. Exact flow (does it require admin
  to acknowledge before the order can continue? can kitchen pick from preset
  reasons or type free text?) still needs deciding once this screen is
  designed.
- **Rider, active delivery:** the live map with trail and distance (already
  built in v1, upgraded in 3.5), customer contact info, delivery notes and
  landmark, and the Pick Up / Delivered actions.

### 3.3 Refund automation

v1: admin refunds manually in the Paystack dashboard, then clicks "Mark
Refunded" in Vhitepizza to update the record. v2: the "Mark Refunded"
button actually calls Paystack's refund API and does it, in one step.

- Server: a new endpoint calls Paystack's refund endpoint with the order's
  payment reference and amount, then updates `payment.status` to `refunded`
  only after Paystack confirms.
- Partial refunds: **PROPOSED**, out of scope for v2 — full refund only,
  matching the current cancellation flow (a cancelled paid order is refunded
  in full).
- Failure handling: if Paystack's refund call fails, the order stays
  `refund_pending` and shows the error, so admin can retry or refund
  manually as a fallback.

### 3.4 Real-time alerts for staff

v1's alert (a Web Audio beep) only fires while the dashboard tab is open and
focused. v2 needs it to work even when the tab is backgrounded or the app
isn't currently open.

- **PROPOSED:** browser push notifications (the Notifications API, with a
  service worker) for "new order," "large order needs approval," and
  "order running long against its time target." Works while the browser is
  open, even in another tab; does not work if the browser itself is fully
  closed.
- A true "closed browser" alert would need a native/PWA install and Firebase
  Cloud Messaging — bigger scope, **PROPOSED for v3** unless staff specifically
  need it sooner.

### 3.5 Customer email notifications

Sent via Brevo at three moments: order **Confirmed**, **Ready**, and
**Delivered**. (Large-order-needs-approval already emails the admin, from
v1 — unchanged.)

- Plain, simple transactional templates — no marketing styling needed.
- Server-side only; the customer's email address already exists on their
  profile and on the order.
- Failure handling: an email failure never blocks or delays the order
  status change itself — it's fire-and-forget with logging, same pattern as
  the existing large-order alert.

### 3.6 Geoapify Routing (real distance/time)

Replaces the current straight-line distance calculation with real road
distance and estimated time, using Geoapify's Routing API.

- Shown on the **rider's** active delivery screen (3.2) instead of the
  straight-line number.
- Shown on the **customer's** order tracking screen once a rider is
  assigned — "Your rider is 12 minutes away," or similar.
- The existing live trail/map (rider position, customer pin, line between
  them) stays; only the distance/time number and the line's accuracy
  improve (a real route rather than a straight line, if the Routing API
  supports it — **PROPOSED**: confirm whether Geoapify's Routing API returns
  a route geometry or just distance/duration, and decide whether to draw
  the real route on the map or keep the simple straight line with an
  accurate number).
- Rate limits: routing calls cost more of Geoapify's daily quota than map
  tiles. **PROPOSED:** poll at most every 15–30 seconds while a delivery is
  active, not on every position update.

### 3.7 Customer delivery time target

A soft target, not an enforced SLA:

- At checkout, the customer can optionally pick "I'd like this within
  ___ minutes." **Presets scale with order size** — a large order (using
  the same size/quantity rule as the existing large-order threshold, or a
  simpler item-count check, **PROPOSED**) doesn't get offered an
  unrealistic fast option; a single pizza gets tighter choices than an
  order of ten. Example shape, **PROPOSED**: small order → 20 / 30 / 45 /
  no preference; large order → 45 / 60 / 90 / no preference. Exact minute
  values and the size cutoff still need picking once the dashboard work
  starts.
- Saved on the order as `requestedByMinutes` or similar, computed into an
  actual target timestamp once the order is placed.
- Staff (kitchen and admin) see a countdown or a flag once the order is
  getting close to or past that target — this is where it connects to 3.4's
  alerts.
- **Nothing else happens automatically if it's missed** — no penalty, no
  refund, no cancellation. It exists so staff prioritize correctly and the
  restaurant protects its reputation, per your framing.

### 3.8 Call + chat bridge (staff <-> customer)

- **Call:** a "Call rider" / "Call restaurant" button on the customer's
  order screen, and the reverse on staff's active-order screens. **PROPOSED:**
  use a calling service built for exactly this (masks real phone numbers,
  connects two parties) rather than exposing real numbers directly — needs
  a provider decision before building.
  **Simplest fallback, no new provider:** a `tel:` link using the phone
  numbers already stored on the order/profile. No number masking, no extra
  service, but ships immediately if the calling-service provider decision
  takes longer to settle.
- **Chat:** a simple text thread attached to the order, staff and customer
  only, no AI. Stored in Firestore as a subcollection on the order
  (`orders/{id}/messages`), readable by the customer and by staff with
  access to that order under existing rules.
- Both close automatically once the order reaches Delivered or Cancelled.

---

## 4. Data model additions

Building on the v1 model in `docs/vhite-pizza-foundations.md`.

**orders/{orderId}** — new fields:
- `requestedByMinutes` (number or null), `requestedByAt` (timestamp, computed
  at order placement)
- `payment.refundedAt`, `payment.refundReference` (once refund automation
  lands)

**orders/{orderId}/messages/{messageId}** — new subcollection:
- `senderId`, `senderRole` (customer | admin | kitchen | rider), `text`,
  `sentAt`

**settings/private** — no changes needed; large-order threshold already
covered in v1.

---

## 5. Server API additions

- `POST /orders/:id/refund` (admin) — calls Paystack's refund API, updates
  the order on success.
- `POST /orders/:id/messages` and a read path (or Firestore listener
  directly, matching the pattern already used for live order updates).
- Email sending: a `sendOrderEmail(order, moment)` service, called from the
  same places `changeStatus`/`markPaid` already fire the large-order email.
- Routing: either a thin server proxy to Geoapify Routing (keeps the key
  server-side, consistent with quote/pricing) or a direct browser call using
  the same restricted Geoapify key the map already uses (consistent with
  how map tiles and address search already work). **PROPOSED:** direct
  browser call, to match the existing pattern and avoid adding server load
  for something that updates frequently during a delivery.

---

## 6. Accounts and setup checklist

**Brevo**
1. Create an account (no credit card required for the free tier).
2. Verify a sending domain or sender email.
3. Generate an API key.
4. Add `BREVO_API_KEY=` to `api/.env` and `api/.env.example`.

**Calling service** (only once 3.8's provider decision is made)
1. TBD — depends on which provider is chosen.

**Geoapify**
- No new setup. Confirm the existing key's daily quota comfortably covers
  routing calls at the polling rate chosen in 3.6.

---

## 7. Open decisions

1. Calling-service provider for 3.8, or ship the simple `tel:` fallback
   first and upgrade later.
2. Whether Geoapify Routing draws a real route line or keeps the straight
   line with an accurate distance/time number.
3. Exact time-target presets (3.7).
4. Whether push alerts (3.4) are enough for v2, or a full native/PWA
   install for background alerts is worth pulling in from v3.
5. Kitchen's "flag a problem" action (3.2) — in scope or deferred.

---

## 8. What comes next

Pick a starting point: the dashboard rebuild (3.1) is the largest single
piece and touches every other feature's UI, so it's the natural place to
begin. Refund automation and Brevo email are each small and independent —
either could be built first as a quick, complete win before the bigger
dashboard work starts.
