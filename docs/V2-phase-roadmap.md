V2 implementation structure
I’ll implement it against the existing architecture rather than rebuilding Vhitepizza:
Phase A — V2 staff shell
Admin: Overview → Orders → Menu → Staff → Users → Settings
Kitchen: Queue → Active Order
Rider: Available → Active Delivery
Dense searchable/filterable order management
Urgency/time-target indicators
Dedicated active-order screens
Phase B — Operations
Kitchen “Flag a problem”
Admin acknowledgement/problem workflow
Automatic Paystack refunds
Brevo transactional emails
Customer/staff call links
Phase C — Delivery intelligence
Geoapify real routing
Road distance
ETA
Rider route geometry
Customer rider ETA
Phase D — Customer checkout
Size-aware delivery-time targets
Store requestedByMinutes
Calculate requestedByAt
Staff countdown/late indicators
Phase E — Browser alerts
New-order push
Large-order approval push
Running-late push
Background-tab support
Native/closed-app notifications deliberately left for V3



Vhitepizza V2 — implementation roadmap
Phase
Main work
Result
Phase 1
Staff/admin dashboard rebuild
Professional role-based navigation, overview, dense order management, search/filter/sort, urgency states, active-order entry
Phase 2
Kitchen + rider active-order experience
Full-screen kitchen/rider order views, problem reporting, delivery controls
Phase 3
Refund automation
Admin refund button directly calls Paystack and records refund
Phase 4
Brevo notifications
Confirmed / Ready / Delivered customer emails
Phase 5
Geoapify routing
Real road route, distance and ETA on rider/customer tracking
Phase 6
Delivery-time targets
Size-dependent 30/45/60-style presets, target timestamps, countdown/late states
Phase 7
Browser push alerts
New order, large-order approval, running-late notifications
Phase 8
Call + chat bridge
tel: calling plus order-specific customer/staff chat
Phase 9
V2 integration / hardening
Permissions, responsive behavior, realtime behavior, testing and production cleanup
V3
Native Expo functionality
Closed-app/native push and the deferred AI agent
