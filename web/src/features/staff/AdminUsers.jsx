import { useEffect, useState } from "react";
import { listAllUsers, setUserActive } from "./orders";
import "./staff.css";

const TABS = [
  { id: "customer", label: "Customers" },
  { id: "admin", label: "Admins" },
  { id: "kitchen", label: "Kitchen" },
  { id: "rider", label: "Riders" },
];

export default function AdminUsers() {
  const [tab, setTab] = useState("customer");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    listAllUsers(tab)
      .then(setUsers)
      .catch(() => setError("Could not load users."))
      .finally(() => setLoading(false));
  }, [tab]);

  const toggleActive = async (member) => {
    setError("");

    try {
      await setUserActive(member.uid, member.active === false);
      setUsers((current) =>
        current.map((item) =>
          item.uid === member.uid
            ? { ...item, active: member.active === false }
            : item
        )
      );
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="staff-list">
      <div className="category-row">
        {TABS.map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? "active" : ""}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && <div className="loc-error">{error}</div>}

      {loading ? (
        <div className="state-box">
          <div className="spinner" />
        </div>
      ) : users.length === 0 ? (
        <p className="staff-empty">No {tab}s yet.</p>
      ) : (
        users.map((member) => (
          <div className="staff-row" key={member.uid}>
            <div>
              <strong>{member.displayName || member.email || "No name"}</strong>
              <small>
                {member.email}
                {member.phone ? ` · ${member.phone}` : ""}
                {member.active === false ? " · disabled" : ""}
              </small>
            </div>

            <label className="staff-switch">
              <input
                type="checkbox"
                checked={member.active !== false}
                onChange={() => toggleActive(member)}
              />
              <span />
            </label>
          </div>
        ))
      )}
    </div>
  );
}
