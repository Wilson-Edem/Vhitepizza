import { useEffect, useState } from "react";
import { ChevronLeft, LogIn, MapPin, Plus, Star, Trash2 } from "lucide-react";
import LocationPicker from "./LocationPicker";
import {
  deleteAddress,
  listAddresses,
  saveAddress,
  setDefaultAddress,
} from "./addresses";
import "./location.css";

export default function AddressesView({ user, dark, onUse, goToAuth, onBack }) {
  const uid = user?.uid;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(Boolean(uid));
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!uid) return undefined;

    let alive = true;

    listAddresses(uid)
      .then((data) => {
        if (alive) setItems(data);
      })
      .catch(() => {
        if (alive) setError("Could not load your addresses.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [uid]);

  const reload = async () => {
    try {
      setItems(await listAddresses(uid));
      setError("");
    } catch {
      setError("Could not load your addresses.");
    }
  };

  const run = async (task) => {
    try {
      await task();
      await reload();
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleSave = async (address, { label }) => {
    setAdding(false);
    await run(() => saveAddress(uid, address, label, items.length === 0));
  };

  return (
    <div className="page-content">
      <div className="page-header settings-header">
        <button aria-label="Back to profile" onClick={onBack}>
          <ChevronLeft size={21} />
        </button>
      </div>

      <div className="page-heading">
        <span>DELIVERY</span>
        <h2>Saved Addresses</h2>
        <p>Where we bring your pizza.</p>
      </div>

      {!user ? (
        <div className="empty-state">
          <MapPin size={34} />
          <p>Sign in to save your delivery addresses.</p>
          <button className="primary-button" onClick={() => goToAuth("addresses")}>
            <LogIn size={18} />
            Sign In
          </button>
        </div>
      ) : (
        <>
          {error && <div className="loc-error">{error}</div>}

          {loading ? (
            <div className="state-box">
              <div className="spinner" />
            </div>
          ) : (
            <div className="address-list">
              {items.length === 0 && (
                <div className="empty-state">
                  <MapPin size={34} />
                  <p>You have no saved addresses yet.</p>
                </div>
              )}

              {items.map((item) => (
                <article className="address-card" key={item.id}>
                  <div className="address-info">
                    <strong>
                      {item.label || "Address"}
                      {item.isDefault && <em>Default</em>}
                    </strong>
                    <p>{item.formattedAddress}</p>
                    <small>
                      {item.phone}
                      {item.landmark ? ` · Near ${item.landmark}` : ""}
                    </small>
                  </div>

                  <div className="address-actions">
                    <button onClick={() => onUse(item)}>Use</button>

                    {!item.isDefault && (
                      <button
                        aria-label="Make default"
                        onClick={() => run(() => setDefaultAddress(uid, item.id))}
                      >
                        <Star size={16} />
                      </button>
                    )}

                    <button
                      aria-label="Delete address"
                      onClick={() => run(() => deleteAddress(uid, item.id))}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <button className="primary-button" onClick={() => setAdding(true)}>
            <Plus size={18} />
            Add New Address
          </button>
        </>
      )}

      {adding && (
        <LocationPicker
          dark={dark}
          canSave
          alwaysSave
          onClose={() => setAdding(false)}
          onConfirm={handleSave}
        />
      )}
    </div>
  );
}
