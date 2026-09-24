import { useMemo, useState } from "react";
import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  UserRound,
  Bike,
  ChefHat,
} from "lucide-react";
import StaffOrders from "./StaffOrders";
import MenuAvailability from "./MenuAvailability";
import StaffAccounts from "./StaffAccounts";
import AdminUsers from "./AdminUsers";
import "./staff.css";

const ADMIN_NAV = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
  },
  {
    id: "orders",
    label: "Orders",
    icon: ClipboardList,
  },
  {
    id: "menu",
    label: "Menu",
    icon: Menu,
  },
  {
    id: "staff",
    label: "Staff",
    icon: Users,
  },
  {
    id: "users",
    label: "Users",
    icon: UserRound,
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
  },
];

const ROLE_CONFIG = {
  admin: {
    title: "Admin",
    subtitle: "Restaurant operations",
    icon: ShieldCheck,
  },
  kitchen: {
    title: "Kitchen",
    subtitle: "Production queue",
    icon: ChefHat,
  },
  rider: {
    title: "Rider",
    subtitle: "Delivery operations",
    icon: Bike,
  },
};

const STATUS_LABELS = {
  pending_approval: "Needs approval",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
};

export default function StaffDashboard({ role, uid, dark }) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.admin;

  const [section, setSection] = useState(
    role === "admin" ? "overview" : "queue"
  );

  const [activeOrder, setActiveOrder] = useState(null);

  const roleNav = useMemo(() => {
    if (role === "admin") {
      return ADMIN_NAV;
    }

    if (role === "kitchen") {
      return [
        {
          id: "queue",
          label: "Queue",
          icon: ClipboardList,
        },
      ];
    }

    return [
      {
        id: "queue",
        label: "Available",
        icon: Bike,
      },
    ];
  }, [role]);

  const title =
    section === "overview"
      ? "Overview"
      : section === "orders"
      ? "Orders"
      : section === "menu"
      ? "Menu"
      : section === "staff"
      ? "Staff"
      : section === "users"
      ? "Users"
      : section === "settings"
      ? "Settings"
      : role === "kitchen"
      ? "Kitchen Queue"
      : "Available Deliveries";

  const openActiveOrder = (order) => {
    setActiveOrder(order);
    setSection("active");
  };

  const returnToQueue = () => {
    setActiveOrder(null);
    setSection(role === "admin" ? "orders" : "queue");
  };

  return (
    <div className="v2-staff-shell">
      <aside className="v2-staff-sidebar">
        <div className="v2-staff-brand">
          <span className="v2-staff-brand-icon">🍕</span>

          <div>
            <strong>Vhite Pizza</strong>
            <span>Operations</span>
          </div>
        </div>

        <div className="v2-role-card">
          <div className="v2-role-icon">
            <config.icon size={18} />
          </div>

          <div>
            <strong>{config.title}</strong>
            <span>{config.subtitle}</span>
          </div>
        </div>

        <nav className="v2-staff-nav" aria-label="Staff navigation">
          {roleNav.map((item) => {
            const Icon = item.icon;
            const selected =
              section === item.id ||
              (item.id === "orders" && section === "active") ||
              (item.id === "queue" && section === "active");

            return (
              <button
                key={item.id}
                className={selected ? "active" : ""}
                onClick={() => {
                  setActiveOrder(null);
                  setSection(item.id);
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {activeOrder && (
          <div className="v2-active-nav-card">
            <span>ACTIVE ORDER</span>
            <strong>{activeOrder.orderNumber}</strong>

            <button onClick={() => setSection("active")}>
              Open active order
            </button>
          </div>
        )}
      </aside>

      <section className="v2-staff-main">
        <header className="v2-staff-header">
          <div>
            <span>STAFF OPERATIONS</span>
            <h1>{title}</h1>
          </div>

          <div className="v2-header-role">
            <config.icon size={17} />
            {config.title}
          </div>
        </header>

        {section === "overview" && role === "admin" && (
          <AdminOverview onOpenOrders={() => setSection("orders")} />
        )}

        {section === "orders" && role === "admin" && (
          <StaffOrders
            role={role}
            uid={uid}
            dark={dark}
            onOpenActive={openActiveOrder}
          />
        )}

        {section === "queue" && role !== "admin" && (
          <StaffOrders
            role={role}
            uid={uid}
            dark={dark}
            onOpenActive={openActiveOrder}
          />
        )}

        {section === "active" && activeOrder && (
          <ActiveOrderPreview
            order={activeOrder}
            role={role}
            uid={uid}
            dark={dark}
            onBack={returnToQueue}
          />
        )}

        {section === "menu" && role === "admin" && <MenuAvailability />}

        {section === "staff" && role === "admin" && <StaffAccounts />}

        {section === "users" && role === "admin" && <AdminUsers />}

        {section === "settings" && role === "admin" && (
          <AdminSettingsPlaceholder />
        )}
      </section>
    </div>
  );
}

function AdminOverview({ onOpenOrders }) {
  return (
    <div className="v2-overview">
      <section className="v2-overview-hero">
        <div>
          <span>RESTAURANT OPERATIONS</span>
          <h2>Everything important in one place.</h2>
          <p>
            Monitor incoming orders, kitchen progress and deliveries from the
            Vhite Pizza operations workspace.
          </p>
        </div>

        <button className="primary-button" onClick={onOpenOrders}>
          Open orders
          <ClipboardList size={17} />
        </button>
      </section>

      <div className="v2-stat-grid">
        <StatCard
          icon={ClipboardList}
          label="Active orders"
          value="Live"
          text="Realtime order queue"
        />

        <StatCard
          icon={ChefHat}
          label="Kitchen"
          value="Live"
          text="Preparing orders"
        />

        <StatCard
          icon={Bike}
          label="Deliveries"
          value="Live"
          text="Rider activity"
        />

        <StatCard
          icon={BarChart3}
          label="Operations"
          value="Ready"
          text="V2 workspace"
        />
      </div>

      <section className="v2-overview-panel">
        <div>
          <span>PHASE 1</span>
          <h3>Operations workspace</h3>
          <p>
            The new dashboard is designed around fast scanning and clear
            operational actions rather than a card-heavy Kanban-only layout.
          </p>
        </div>

        <div className="v2-overview-points">
          <span>✓ Search orders and customers</span>
          <span>✓ Filter by operational status</span>
          <span>✓ Sort by age and urgency</span>
          <span>✓ Open focused order views</span>
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, text }) {
  return (
    <article className="v2-stat-card">
      <div className="v2-stat-icon">
        <Icon size={18} />
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{text}</small>
      </div>
    </article>
  );
}

function ActiveOrderPreview({ order, role, onBack }) {
  const customer = order.customer?.name || "Customer";

  return (
    <div className="v2-active-screen">
      <div className="v2-active-toolbar">
        <button className="v2-back-button" onClick={onBack}>
          ← Back to {role === "admin" ? "orders" : "queue"}
        </button>

        <span className="v2-live-badge">LIVE ORDER</span>
      </div>

      <section className="v2-active-header-card">
        <div>
          <span>ORDER</span>
          <h2>{order.orderNumber}</h2>
          <p>{customer}</p>
        </div>

        <div className="v2-active-status">
          <span>Status</span>
          <strong>
            {STATUS_LABELS[order.status] || order.status}
          </strong>
        </div>
      </section>

      <section className="v2-active-grid">
        <div className="v2-active-panel">
          <div className="v2-panel-heading">
            <div>
              <span>ORDER ITEMS</span>
              <h3>Full order details</h3>
            </div>
          </div>

          <div className="v2-active-items">
            {(order.items || []).map((item, index) => (
              <div className="v2-active-item" key={`${item.productId}-${index}`}>
                <div>
                  <strong>
                    {item.quantity} × {item.name}
                  </strong>

                  <span>{item.sizeLabel}</span>

                  {item.details?.length > 0 && (
                    <small>{item.details.join(" · ")}</small>
                  )}

                  {item.note && <small>Note: {item.note}</small>}
                </div>

                <strong>
                  ₦{Number(item.lineTotal || 0).toLocaleString("en-NG")}
                </strong>
              </div>
            ))}
          </div>
        </div>

        <div className="v2-active-side">
          <div className="v2-active-panel">
            <span>DELIVERY</span>
            <h3>{order.address?.formattedAddress || "No address"}</h3>

            {order.address?.landmark && (
              <p>Landmark: {order.address.landmark}</p>
            )}

            {order.address?.notes && (
              <p>Notes: {order.address.notes}</p>
            )}
          </div>

          <div className="v2-active-panel">
            <span>CUSTOMER</span>
            <h3>{customer}</h3>

            {order.customer?.phone && (
              <a
                className="v2-call-button"
                href={`tel:${order.customer.phone}`}
              >
                Call customer
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function AdminSettingsPlaceholder() {
  return (
    <section className="v2-empty-panel">
      <Settings size={28} />
      <h2>Settings</h2>
      <p>
        Existing restaurant settings remain available through the current
        backend configuration. V2 settings controls will be added in the
        operations phases.
      </p>
    </section>
  );
                }
