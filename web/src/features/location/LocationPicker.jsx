import { useEffect, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { ExternalLink, LocateFixed, Search, X } from "lucide-react";
import "leaflet/dist/leaflet.css";
import {
  hasGeoapifyKey,
  isValidPhone,
  reverseGeocode,
  searchPlaces,
  tileUrl,
} from "./geoapify";
import "./location.css";

const LAGOS = [6.5244, 3.3792];
const MAP_URL = import.meta.env.VITE_MAP_URL;
const ATTRIBUTION =
  '&copy; <a href="https://www.geoapify.com/">Geoapify</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// A simple CSS pin, so no image files are needed.
const PIN_ICON = L.divIcon({
  className: "map-pin-wrap",
  html: '<span class="map-pin"></span>',
  iconSize: [30, 42],
  iconAnchor: [15, 40],
});

function MapClicks({ onPick }) {
  useMapEvents({
    click: (event) => onPick(event.latlng.lat, event.latlng.lng),
  });

  return null;
}

function Recenter({ lat, lng, zoom }) {
  const map = useMap();

  useEffect(() => {
    if (lat !== null && lng !== null) map.setView([lat, lng], zoom);
  }, [lat, lng, zoom, map]);

  return null;
}

export default function LocationPicker({
  dark,
  initial,
  canSave,
  alwaysSave = false,
  onClose,
  onConfirm,
}) {
  const hasStart = Number.isFinite(initial?.lat) && Number.isFinite(initial?.lng);

  const [position, setPosition] = useState(
    hasStart ? { lat: initial.lat, lng: initial.lng } : null
  );
  const [zoom, setZoom] = useState(hasStart ? 17 : 12);
  const [address, setAddress] = useState(initial?.formattedAddress || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [landmark, setLandmark] = useState(initial?.landmark || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [source, setSource] = useState(initial?.source || "manual");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [save, setSave] = useState(alwaysSave);
  const [label, setLabel] = useState("");

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // Address suggestions while typing (waits a moment after each keystroke).
  useEffect(() => {
    const text = query.trim();
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      if (text.length < 3 || !hasGeoapifyKey) {
        setResults([]);
        return;
      }

      try {
        setResults(await searchPlaces(text, controller.signal));
      } catch (err) {
        if (err.name !== "AbortError") setResults([]);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Puts the pin somewhere and looks up the street address for it.
  const pick = async (lat, lng, from = "pin") => {
    setPosition({ lat, lng });
    setZoom(17);
    setSource(from);
    setResults([]);
    setMessage("");
    setBusy("lookup");

    try {
      const place = await reverseGeocode(lat, lng);

      if (place) {
        setAddress(place.formattedAddress);
      } else {
        setMessage("We could not find a street name here. Type your address below.");
      }
    } catch {
      setMessage("Address lookup failed. Type your address below.");
    } finally {
      setBusy("");
    }
  };

  const choosePlace = (place) => {
    setPosition({ lat: place.lat, lng: place.lng });
    setZoom(17);
    setAddress(place.formattedAddress);
    setSource("search");
    setResults([]);
    setQuery("");
    setMessage("");
  };

  const locateMe = () => {
    if (!navigator.geolocation) {
      setMessage("Your browser cannot share your location. Search or type your address.");
      return;
    }

    setBusy("gps");
    setMessage("");

    navigator.geolocation.getCurrentPosition(
      (result) => {
        setBusy("");
        pick(result.coords.latitude, result.coords.longitude, "pin");
      },
      () => {
        setBusy("");
        setMessage(
          "We could not get your location. Allow location access, or search or type your address."
        );
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const confirm = () => {
    if (address.trim().length < 5) {
      setError("Enter your delivery address.");
      return;
    }

    if (!isValidPhone(phone)) {
      setError("Enter a phone number the rider can call.");
      return;
    }

    setError("");

    onConfirm(
      {
        formattedAddress: address.trim(),
        lat: position ? position.lat : null,
        lng: position ? position.lng : null,
        phone: phone.trim(),
        landmark: landmark.trim(),
        notes: notes.trim(),
        source: position ? source : "manual",
      },
      { save: alwaysSave || save, label: label.trim() }
    );
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="loc-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Choose delivery location"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="loc-header">
          <div>
            <h2>Delivery location</h2>
            <p>Use the map, search, or type your address.</p>
          </div>

          <button aria-label="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {!hasGeoapifyKey && (
          <div className="loc-note">
            Map and search are off. Add VITE_GEOAPIFY_KEY to web/.env and
            restart the web app. You can still type your address.
          </div>
        )}

        <label className="search-field loc-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search your street, area or landmark"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        {results.length > 0 && (
          <ul className="loc-results">
            {results.map((place) => (
              <li key={`${place.lat},${place.lng},${place.formattedAddress}`}>
                <button onClick={() => choosePlace(place)}>
                  {place.formattedAddress}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="loc-map">
          <MapContainer
            center={position ? [position.lat, position.lng] : LAGOS}
            zoom={zoom}
            scrollWheelZoom
          >
            {hasGeoapifyKey && (
              <TileLayer
                key={dark ? "dark" : "light"}
                url={tileUrl(dark)}
                attribution={ATTRIBUTION}
                maxZoom={20}
              />
            )}

            <MapClicks onPick={pick} />
            <Recenter
              lat={position ? position.lat : null}
              lng={position ? position.lng : null}
              zoom={zoom}
            />

            {position && (
              <Marker
                position={[position.lat, position.lng]}
                icon={PIN_ICON}
                draggable
                eventHandlers={{
                  dragend: (event) => {
                    const point = event.target.getLatLng();
                    pick(point.lat, point.lng, "pin");
                  },
                }}
              />
            )}
          </MapContainer>
        </div>

        <div className="loc-actions">
          <button className="loc-locate" onClick={locateMe} disabled={busy === "gps"}>
            <LocateFixed size={17} />
            {busy === "gps" ? "Finding you..." : "Use my current location"}
          </button>

          {MAP_URL && (
            <a href={MAP_URL} target="_blank" rel="noreferrer">
              View my exact live location in VhiteMap
              <ExternalLink size={14} />
            </a>
          )}
        </div>

        {message && <div className="loc-note">{message}</div>}

        <div className="loc-form">
          <label className="loc-field">
            <span>
              Delivery address {busy === "lookup" && "(looking up...)"}
            </span>
            <textarea
              rows={2}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="House number, street, area, city"
            />
          </label>

          <label className="loc-field">
            <span>Phone number</span>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              autoComplete="tel"
              placeholder="0801 234 5678"
            />
          </label>

          <label className="loc-field">
            <span>Nearest landmark</span>
            <input
              type="text"
              value={landmark}
              onChange={(event) => setLandmark(event.target.value)}
              placeholder="Opposite the filling station"
            />
          </label>

          <label className="loc-field">
            <span>Delivery notes (optional)</span>
            <input
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Gate colour, floor, how to reach you"
            />
          </label>

          {canSave && !alwaysSave && (
            <label className="loc-check">
              <input
                type="checkbox"
                checked={save}
                onChange={(event) => setSave(event.target.checked)}
              />
              Save this address to my account
            </label>
          )}

          {(alwaysSave || save) && (
            <label className="loc-field">
              <span>Name this address (optional)</span>
              <input
                type="text"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Home, Work"
              />
            </label>
          )}
        </div>

        {error && <div className="loc-error">{error}</div>}

        <button className="primary-button" onClick={confirm}>
          Confirm location
        </button>
      </div>
    </div>
  );
}
