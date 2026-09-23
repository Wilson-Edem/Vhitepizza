import { useEffect, useState } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { Navigation } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { tileUrl } from "../location/geoapify";
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

const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

// Straight-line distance in kilometres between two points.
function distanceKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(x));
}

function FitBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (points.length < 2) return;

    map.fitBounds(points, { padding: [30, 30], maxZoom: 16 });
  }, [points, map]);

  return null;
}

// Shown once a rider has claimed an order. Watches the rider's live
// position and draws a line to the customer's delivery pin, with the
// straight-line distance between them.
export default function RiderDeliveryMap({ dark, customer }) {
  const [rider, setRider] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Your browser cannot share your location.");
      return undefined;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) =>
        setRider({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      () => setError("Turn on location access to see the route."),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const hasCustomer = Number.isFinite(customer?.lat) && Number.isFinite(customer?.lng);

  if (!hasCustomer) {
    return (
      <div className="rider-map-note">
        This order has no map location saved, so a route cannot be shown.
      </div>
    );
  }

  const points = rider ? [rider, customer] : [customer];

  return (
    <div className="rider-map-block">
      <div className="rider-map">
        <MapContainer center={[customer.lat, customer.lng]} zoom={14} scrollWheelZoom={false}>
          <TileLayer
            key={dark ? "dark" : "light"}
            url={tileUrl(dark)}
            attribution="&copy; Geoapify | &copy; OpenStreetMap contributors"
            maxZoom={20}
          />

          <FitBounds points={points.map((p) => [p.lat, p.lng])} />

          <Marker position={[customer.lat, customer.lng]} icon={CUSTOMER_ICON} />

          {rider && (
            <>
              <Marker position={[rider.lat, rider.lng]} icon={RIDER_ICON} />
              <Polyline
                positions={[
                  [rider.lat, rider.lng],
                  [customer.lat, customer.lng],
                ]}
                pathOptions={{ color: "#cc4a1c", weight: 3, dashArray: "6 8" }}
              />
            </>
          )}
        </MapContainer>
      </div>

      <div className="rider-distance">
        <Navigation size={14} />
        {rider
          ? `${distanceKm(rider, customer).toFixed(1)} km to the customer (straight line)`
          : error || "Finding your location..."}
      </div>
    </div>
  );
}
