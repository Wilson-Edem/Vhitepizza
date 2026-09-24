import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import "./staff.css";

const ROLES = ["admin", "kitchen", "rider"];

export default function StaffAccounts() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("kitchen");
  const [busy, setBusy] = useState(false);

  const load = () =>
    apiFetch("/admin/staff")
      .then(setStaff)
      .catch(() => setError("Could not load staff accounts."))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const addStaff = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await apiFetch("/admin/staff", { method: "POST", body: { email, role } });
      setEmail("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const setActive = async (member, active) => {
    setError("");

    try {
      await apiFetch(`/admin/staff/${member.uid}/active`, {
        method: "PATCH",
        body: { active },
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="staff-list">
      {error && <div className="loc-error">{error}</div>}

      <form className="staff-add-form" onSubmit={addStaff}>
        <input
          type="email"
          placeholder="Existing account's email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <select value={role} onChange={(event) => setRole(event.target.value)}>
          {ROLES.map((item) => (
            <option key={item} value={item}>
              {item[0].toUpperCase() + item.slice(1)}
            </option>
          ))}
        </select>

        <button className="primary-button" disabled={busy}>
          Add
        </button>
      </form>

      <p className="staff-hint">
        The person must already have a Vhitepizza account (they sign up like
        any customer first). This only changes their role.
      </p>

      {loading ? (
        <div className="state-box">
          <div className="spinner" />
        </div>
      ) : (
        staff.map((member) => (
          <div className="staff-row" key={member.uid}>
            <div>
              <strong>{member.displayName || member.email}</strong>
              <small>
                {member.email} · {member.role}
                {member.active === false ? " · disabled" : ""}
              </small>
            </div>

            <label className="staff-switch">
              <input
                type="checkbox"
                checked={member.active !== false}
                onChange={(event) => setActive(member, event.target.checked)}
              />
              <span />
            </label>
          </div>
        ))
      )}
    </div>
  );
}
