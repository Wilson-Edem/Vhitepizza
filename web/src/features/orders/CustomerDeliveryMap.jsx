import { useEffect, useState } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { Navigation } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { routeDriving, tileUrl } from "../location/geoapify";
import "../staff/staff.css";

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

export default function CustomerDeliveryMap({ dark, customer, rider }) {
  const [route, setRoute] = useState(null);
  const [error, setError] = useState("");

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
          setError(err.message || "Road route unavailable.");
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

  if (!isPoint(customer) || !isPoint(rider)) {
    return (
      <div className="rider-map-note">
        Your rider's live location is not available yet. This screen will update automatically.
      </div>
    );
  }

  const points = [rider, customer];
  const fallbackLine = [
    [rider.lat, rider.lng],
    [customer.lat, customer.lng],
  ];

  return (
    <div className="rider-map-block customer-delivery-map">
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
          <Marker position={[rider.lat, rider.lng]} icon={RIDER_ICON} />

          <Polyline
            positions={route?.geometry?.length > 1 ? route.geometry : fallbackLine}
            pathOptions={{
              color: "#cc4a1c",
              weight: 4,
              opacity: route?.geometry?.length > 1 ? 0.9 : 0.55,
              dashArray: route?.geometry?.length > 1 ? undefined : "6 8",
            }}
          />
        </MapContainer>
      </div>

      <div className="rider-distance">
        <Navigation size={14} />
        {route
          ? `Your rider is about ${Math.max(1, Math.round(route.durationMinutes))} min away · ${route.distanceKm.toFixed(1)} km`
          : "Calculating road ETA..."}
      </div>

      {error && <div className="rider-route-note">{error}</div>}
    </div>
  );
}
