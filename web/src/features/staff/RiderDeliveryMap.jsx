import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { Navigation } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { routeDriving, tileUrl } from "../location/geoapify";
import { apiFetch } from "../../lib/api";
import "./staff.css";

const RIDER_ICON = L.divIcon({
  className: "map-pin-wrap",
  html: '<span class="map-pin rider-pin"></span>',
  iconSize: [30, 42],
  iconAnchor: [15, 40],
});

const CUSTOMER_ICON = L.divIcon({
  className: "map-pin-wrap",
  html: '<span class="map-pin"></span>',
  iconSize: [30, 42],
  iconAnchor: [15, 40],
});

const isPoint = (point) =>
  Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng));

function FitBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (points.length < 2) return;
    map.fitBounds(points, { padding: [30, 30], maxZoom: 16 });
  }, [points, map]);

  return null;
}

export default function RiderDeliveryMap({ dark, customer, orderId }) {
  const [rider, setRider] = useState(null);
  const [route, setRoute] = useState(null);
  const [error, setError] = useState("");
  const [locationSaving, setLocationSaving] = useState(false);
  const lastSentAt = useRef(0);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Your browser cannot share your location.");
      return undefined;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setRider({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setError("");
      },
      () => setError("Turn on location access to see the road route."),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Share the rider's latest position with the order so the customer can
  // see it on their own tracking screen. Updates are throttled to avoid
  // writing on every browser GPS event.
  useEffect(() => {
    if (!rider || !orderId) return undefined;

    const now = Date.now();
    if (now - lastSentAt.current < 10000) return undefined;

    let cancelled = false;
    setLocationSaving(true);

    apiFetch(`/orders/${encodeURIComponent(orderId)}/location`, {
      method: "PATCH",
      body: { lat: rider.lat, lng: rider.lng },
    })
      .catch((err) => {
        if (!cancelled) console.warn("Rider location update failed:", err.message);
      })
      .finally(() => {
        if (!cancelled) {
          lastSentAt.current = Date.now();
          setLocationSaving(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [rider, orderId]);

  // Routing is deliberately polled, rather than recalculated for every GPS
  // update, because Routing API calls consume more Geoapify quota than map tiles.
  useEffect(() => {
    if (!isPoint(rider) || !isPoint(customer)) return undefined;

    let cancelled = false;
    let controller = new AbortController();

    const refresh = async () => {
      controller.abort();
      controller = new AbortController();

      try {
        const next = await routeDriving(rider, customer, controller.signal);
        if (!cancelled) {
          setRoute(next);
          setError("");
        }
      } catch (err) {
        if (!cancelled && err.name !== "AbortError") {
          setError(err.message || "Road route unavailable. Showing direct distance.");
        }
      }
    };

    refresh();
    const timer = window.setInterval(refresh, 20000);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [rider?.lat, rider?.lng, customer?.lat, customer?.lng]);

  const hasCustomer = isPoint(customer);

  if (!hasCustomer) {
    return (
      <div className="rider-map-note">
        This order has no map location saved, so a route cannot be shown.
      </div>
    );
  }

  const points = rider ? [rider, customer] : [customer];
  const fallbackLine = rider
    ? [
        [rider.lat, rider.lng],
        [customer.lat, customer.lng],
      ]
    : [];

  return (
    <div className="rider-map-block">
      <div className="rider-map">
        <MapContainer
          center={[customer.lat, customer.lng]}
          zoom={14}
          scrollWheelZoom={false}
        >
          <TileLayer
            key={dark ? "dark" : "light"}
            url={tileUrl(dark)}
            attribution="&copy; Geoapify | &copy; OpenStreetMap contributors"
            maxZoom={20}
          />

          <FitBounds points={points.map((p) => [p.lat, p.lng])} />
          <Marker position={[customer.lat, customer.lng]} icon={CUSTOMER_ICON} />

          {rider && (
            <Marker position={[rider.lat, rider.lng]} icon={RIDER_ICON} />
          )}

          {(route?.geometry?.length > 1 || fallbackLine.length > 1) && (
            <Polyline
              positions={route?.geometry?.length > 1 ? route.geometry : fallbackLine}
              pathOptions={{
                color: "#cc4a1c",
                weight: 4,
                opacity: route?.geometry?.length > 1 ? 0.9 : 0.55,
                dashArray: route?.geometry?.length > 1 ? undefined : "6 8",
              }}
            />
          )}
        </MapContainer>
      </div>

      <div className="rider-distance">
        <Navigation size={14} />
        {route ? (
          <>
            {route.distanceKm.toFixed(1)} km · about {Math.max(1, Math.round(route.durationMinutes))} min
            {locationSaving ? " · updating location" : ""}
          </>
        ) : rider ? (
          "Calculating road distance..."
        ) : (
          error || "Finding your location..."
        )}
      </div>

      {error && route && <div className="rider-route-note">{error}</div>}
    </div>
  );
}
