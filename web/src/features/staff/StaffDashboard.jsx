import { useEffect, useMemo, useState } from "react";
import { BarChart3, Bike, ChefHat, ClipboardList, LayoutDashboard, Menu, Phone, Settings, ShieldCheck, UserRound, Users } from "lucide-react";
import StaffOrders, { STATUS_LABELS } from "./StaffOrders";
import MenuAvailability from "./MenuAvailability";
import StaffAccounts from "./StaffAccounts";
import AdminUsers from "./AdminUsers";
import RiderDeliveryMap from "./RiderDeliveryMap";
import { apiFetch } from "../../lib/api";
import "./staff.css";

const ADMIN_NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "menu", label: "Menu", icon: Menu },
  { id: "staff", label: "Staff", icon: Users },
  { id: "users", label: "Users", icon: UserRound },
  { id: "settings", label: "Settings", icon: Settings },
];

const ROLE_CONFIG = {
  admin: { title: "Admin", subtitle: "Restaurant operations", icon: ShieldCheck },
  kitchen: { title: "Kitchen", subtitle: "Production queue", icon: ChefHat },
  rider: { title: "Rider", subtitle: "Delivery operations", icon: Bike },
};

export default function StaffDashboard({ role, uid, dark, onExit }) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.admin;
  const [section, setSection] = useState(role === "admin" ? "overview" : "queue");
  const [activeOrder, setActiveOrder] = useState(null);
const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
  try {
    return localStorage.getItem("v2-staff-collapsed") === "true";
  } catch {
    return false;
  }
});

useEffect(() => {
  try {
    localStorage.setItem("v2-staff-collapsed", String(collapsed));
  } catch {
    // ignore storage errors
  }
}, [collapsed]);

  const roleNav = useMemo(() => {
    if (role === "admin") return ADMIN_NAV;
    return [{ id: "queue", label: role === "kitchen" ? "Queue" : "Available", icon: role === "kitchen" ? ClipboardList : Bike }];
  }, [role]);

  const title = section === "overview" ? "Overview" : section === "orders" ? "Orders" : section === "menu" ? "Menu" : section === "staff" ? "Staff" : section === "users" ? "Users" : section === "settings" ? "Settings" : section === "active" ? (role === "kitchen" ? "Active Kitchen Order" : "Active Delivery") : role === "kitchen" ? "Kitchen Queue" : "Available Deliveries";

  const openActiveOrder = (order) => { setActiveOrder(order); setSection("active"); };
  const returnToQueue = () => { setActiveOrder(null); setSection(role === "admin" ? "orders" : "queue"); };

  return (
    <div className={`v2-staff-shell ${collapsed ? "is-collapsed" : ""}`}>
          {menuOpen && (
  <div
    className="v2-drawer-backdrop"
    onClick={() => setMenuOpen(false)}
  />
)}

<aside
  className={`v2-staff-sidebar ${menuOpen ? "drawer-open" : ""}`}
>
        <div className="v2-staff-brand">
          <span className="v2-staff-brand-icon">🍕</span>

          <div className="v2-staff-brand-text">
            <strong>Vhitepizza</strong>
            <span>Operations</span>
          </div>

          <button
            className="v2-sidebar-toggle"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? "→" : "←"}
          </button>
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
  setMenuOpen(false);
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

        <button
          className="v2-exit-button"
          onClick={onExit}
        >
          ← Exit to store
        </button>
      </aside>

      <section className="v2-staff-main">
       <header className="v2-staff-header">
  <div className="v2-staff-header-left">
    <button
      className="v2-mobile-menu-button"
      onClick={() => setMenuOpen(true)}
      aria-label="Open menu"
    >
      ☰
    </button>

    <div>
      <span>STAFF OPERATIONS</span>
      <h1>{title}</h1>
    </div>
  </div>

  <div className="v2-header-role">
    <config.icon size={17} />
    {config.title}
  </div>
</header>

        {section === "overview" && role === "admin" && <AdminOverview onOpenOrders={() => setSection("orders")} />}
        {section === "orders" && role === "admin" && <StaffOrders role={role} uid={uid} dark={dark} onOpenActive={openActiveOrder} />}
        {section === "queue" && role !== "admin" && <StaffOrders role={role} uid={uid} dark={dark} onOpenActive={openActiveOrder} />}
        {section === "active" && activeOrder && <ActiveOrderWorkspace order={activeOrder} role={role} uid={uid} dark={dark} onBack={returnToQueue} />}
        {section === "menu" && role === "admin" && <MenuAvailability />}
        {section === "staff" && role === "admin" && <StaffAccounts />}
        {section === "users" && role === "admin" && <AdminUsers />}
        {section === "settings" && role === "admin" && (
  <AdminSettings />
)}
      </section>
    </div>
  );
}

function AdminOverview({ onOpenOrders }) {
  return <div className="v2-overview"><section className="v2-overview-hero"><div><span>RESTAURANT OPERATIONS</span><h2>Everything important in one place.</h2><p>Monitor incoming orders, kitchen progress and deliveries from the Vhitepizza operations workspace.</p></div><button className="primary-button" onClick={onOpenOrders}>Open orders<ClipboardList size={17} /></button></section><div className="v2-stat-grid"><StatCard icon={ClipboardList} label="Active orders" value="Live" text="Realtime order queue" /><StatCard icon={ChefHat} label="Kitchen" value="Live" text="Preparing orders" /><StatCard icon={Bike} label="Deliveries" value="Live" text="Rider activity" /><StatCard icon={BarChart3} label="Operations" value="Ready" text="V2 workspace" /></div></div>;
}

function StatCard({ icon: Icon, label, value, text }) { return <article className="v2-stat-card"><div className="v2-stat-icon"><Icon size={18} /></div><div><span>{label}</span><strong>{value}</strong><small>{text}</small></div></article>; }

function ActiveOrderWorkspace({ order, role, uid, dark, onBack }) {
  const customer = order.customer?.name || "Customer";
  const isRider = role === "rider";
  const isKitchen = role === "kitchen";
  const items = order.items || [];

  return <div className="v2-active-screen">
    <div className="v2-active-toolbar"><button className="v2-back-button" onClick={onBack}>← Back to {isKitchen ? "queue" : isRider ? "available deliveries" : "orders"}</button><span className="v2-live-badge">LIVE ORDER</span></div>

    <section className="v2-active-header-card"><div><span>ORDER</span><h2>{order.orderNumber}</h2><p>{customer}</p></div><div className="v2-active-status"><span>Status</span><strong>{STATUS_LABELS[order.status] || order.status}</strong></div></section>

    {order.problem?.active && <section className="v2-active-problem"><AlertIcon /><div><strong>Problem flagged</strong><p>{order.problem.reason}</p><small>Reported by {order.problem.byRole || "staff"}</small></div></section>}

    <section className="v2-active-grid">
      <div className="v2-active-main-column">
        <div className="v2-active-panel"><div className="v2-panel-heading"><div><span>ORDER ITEMS</span><h3>Full order details</h3></div><strong>{items.length} line{items.length === 1 ? "" : "s"}</strong></div><div className="v2-active-items">
          {items.map((item, index) => <div className="v2-active-item" key={`${item.productId || item.name}-${index}`}><div><strong>{item.quantity} × {item.name}</strong><span>{item.sizeLabel || "Standard"}</span>{item.details?.length > 0 && <small>{item.details.join(" · ")}</small>}{item.note && <small>Note: {item.note}</small>}</div><strong>{`₦${Number(item.lineTotal || 0).toLocaleString("en-NG")}`}</strong></div>)}
        </div></div>

        {isRider && <div className="v2-active-panel"><div className="v2-panel-heading"><div><span>LIVE DELIVERY</span><h3>Rider route</h3></div></div><RiderDeliveryMap
  dark={false}
  customer={order.address}
  orderId={order.id}
/></div>}
      </div>

      <div className="v2-active-side">
        <div className="v2-active-panel"><span>DELIVERY</span><h3>{order.address?.formattedAddress || "No address"}</h3>{order.address?.landmark && <p>Landmark: {order.address.landmark}</p>}{order.address?.notes && <p>Notes: {order.address.notes}</p>}{order.address?.phone && <p>Delivery phone: {order.address.phone}</p>}</div>
        <div className="v2-active-panel"><span>CUSTOMER</span><h3>{customer}</h3>{order.customer?.phone && <a className="v2-call-button" href={`tel:${order.customer.phone}`}><Phone size={15} /> Call customer</a>}</div>
        <div className="v2-active-panel"><span>ORDER TOTAL</span><h3>{`₦${Number(order.pricing?.total || 0).toLocaleString("en-NG")}`}</h3><p>Subtotal: ₦{Number(order.pricing?.subtotal || 0).toLocaleString("en-NG")}</p><p>Delivery: ₦{Number(order.pricing?.deliveryFee || 0).toLocaleString("en-NG")}</p></div>
      </div>
    </section>
  </div>;
}

function AlertIcon() { return <span className="v2-problem-icon"><span>!</span></span>; }
function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/admin/settings")
      .then(setSettings)
      .catch((e) => setError(e.message));
  }, []);

  const update = (patch) =>
    setSettings((current) => ({ ...current, ...patch }));

  const save = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiFetch("/admin/settings", {
        method: "PATCH",
        body: {
          flatDeliveryFee: Number(settings.flatDeliveryFee || 0),
          freeDeliveryEnabled: settings.freeDeliveryEnabled !== false,
          freeDeliveryMin: Number(settings.freeDeliveryMin || 0),
        },
      });
      setMessage("Saved.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <section className="v2-empty-panel">
        <p>Loading settings...</p>
      </section>
    );
  }

  return (
    <section className="v2-settings-panel">
      <h2>Delivery settings</h2>

      {error && <div className="v2-error">{error}</div>}
      {message && <div className="v2-success">{message}</div>}

      <div className="v2-setting-row">
        <div>
          <strong>Flat delivery fee</strong>
          <small>₦ — charged for orders above the free-delivery threshold</small>
        </div>
        <input
          type="number"
          min="0"
          value={settings.flatDeliveryFee || 0}
          onChange={(e) => update({ flatDeliveryFee: e.target.value })}
        />
      </div>

      <div className="v2-setting-row">
        <div>
          <strong>Free delivery threshold</strong>
          <small>Orders below this subtotal pay no delivery fee</small>
        </div>
        <input
          type="number"
          min="0"
          value={settings.freeDeliveryMin || 0}
          onChange={(e) => update({ freeDeliveryMin: e.target.value })}
        />
      </div>

      <div className="v2-setting-row">
        <div>
          <strong>Enable free delivery rule</strong>
          <small>When off, every order pays the flat delivery fee</small>
        </div>
        <label className="staff-switch">
          <input
            type="checkbox"
            checked={settings.freeDeliveryEnabled !== false}
            onChange={(e) => update({ freeDeliveryEnabled: e.target.checked })}
          />
          <span />
        </label>
      </div>

      <button
        className="v2-primary-action"
        onClick={save}
        disabled={saving}
      >
        {saving ? "Saving..." : "Save settings"}
      </button>
    </section>
  );
}
