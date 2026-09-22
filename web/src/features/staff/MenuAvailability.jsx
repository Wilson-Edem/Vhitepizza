import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import "./staff.css";

const MENU_URL = `${
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1"
}/menu`;

export default function MenuAvailability() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    fetch(MENU_URL)
      .then((response) => response.json())
      .then((result) => setProducts((result.data ?? result).products || []))
      .catch(() => setError("Could not load the menu."))
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (product) => {
    setBusyId(product.id);
    setError("");

    try {
      const next = !(product.available !== false);

      await apiFetch(`/admin/products/${product.id}`, {
        method: "PATCH",
        body: { available: next },
      });

      setProducts((current) =>
        current.map((item) =>
          item.id === product.id ? { ...item, available: next } : item
        )
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  };

  if (loading) {
    return (
      <div className="state-box">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="staff-list">
      {error && <div className="loc-error">{error}</div>}

      {products.map((product) => {
        const available = product.available !== false;

        return (
          <div className="staff-row" key={product.id}>
            <div>
              <strong>{product.name}</strong>
              <small>{available ? "Available" : "Sold out"}</small>
            </div>

            <label className="staff-switch">
              <input
                type="checkbox"
                checked={available}
                disabled={busyId === product.id}
                onChange={() => toggle(product)}
              />
              <span />
            </label>
          </div>
        );
      })}
    </div>
  );
}
