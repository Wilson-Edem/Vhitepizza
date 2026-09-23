import { useState } from "react";
import StaffOrders from "./StaffOrders";
import MenuAvailability from "./MenuAvailability";
import StaffAccounts from "./StaffAccounts";
import AdminUsers from "./AdminUsers";
import "./staff.css";

const ADMIN_TABS = [
  { id: "orders", label: "Orders" },
  { id: "menu", label: "Menu" },
  { id: "staff", label: "Staff" },
  { id: "users", label: "Users" },
];

const TITLES = {
  admin: "Admin Dashboard",
  kitchen: "Kitchen Queue",
  rider: "Rider Deliveries",
};

// Drop this in for the old "Nothing to show yet" StaffView placeholder.
export default function StaffDashboard({ role, uid, dark }) {
  const [tab, setTab] = useState("orders");

  return (
    <div className="page-content">
      <div className="page-heading">
        <span>STAFF</span>
        <h2>{TITLES[role] || "Staff"}</h2>
      </div>

      {role === "admin" && (
        <div className="category-row">
          {ADMIN_TABS.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "active" : ""}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {(role !== "admin" || tab === "orders") && (
        <StaffOrders role={role} uid={uid} dark={dark} />
      )}

      {role === "admin" && tab === "menu" && <MenuAvailability />}
      {role === "admin" && tab === "staff" && <StaffAccounts />}
      {role === "admin" && tab === "users" && <AdminUsers />}
    </div>
  );
}
