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
