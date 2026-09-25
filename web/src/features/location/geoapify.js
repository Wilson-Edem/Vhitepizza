const KEY = import.meta.env.VITE_GEOAPIFY_KEY;
const GEOCODE_BASE = "https://api.geoapify.com/v1/geocode";
const ROUTING_BASE = "https://api.geoapify.com/v1/routing";

export const hasGeoapifyKey = Boolean(KEY);

export const isValidPhone = (value) =>
  /^[0-9+\-\s()]{7,20}$/.test(String(value).trim());

export const tileUrl = (dark) =>
  `https://maps.geoapify.com/v1/tile/${
    dark ? "dark-matter" : "osm-bright"
  }/{z}/{x}/{y}.png?apiKey=${KEY}`;

const toPlace = (item) => ({
  formattedAddress: item.formatted || item.address_line1 || "",
  lat: item.lat,
  lng: item.lon,
});

export async function searchPlaces(text, signal) {
  const url =
    `${GEOCODE_BASE}/autocomplete?text=${encodeURIComponent(text)}` +
    `&filter=countrycode:ng&limit=5&format=json&apiKey=${KEY}`;

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Address search failed.");

  const data = await response.json();

  return (data.results || [])
    .map(toPlace)
    .filter(
      (place) =>
        place.formattedAddress &&
        Number.isFinite(place.lat) &&
        Number.isFinite(place.lng)
    );
}

export async function reverseGeocode(lat, lng, signal) {
  const url = `${GEOCODE_BASE}/reverse?lat=${lat}&lon=${lng}&format=json&apiKey=${KEY}`;

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Address lookup failed.");

  const data = await response.json();
  return data.results?.[0] ? toPlace(data.results[0]) : null;
}

function validPoint(point) {
  return (
    Number.isFinite(Number(point?.lat)) &&
    Number.isFinite(Number(point?.lng))
  );
}

function routeCoordinates(featureCollection) {
  const geometry = featureCollection?.features?.[0]?.geometry;
  if (!geometry) return [];

  if (geometry.type === "LineString") {
    return geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  }

  if (geometry.type === "MultiLineString") {
    return geometry.coordinates.flatMap((line) =>
      line.map(([lng, lat]) => [lat, lng])
    );
  }

  return [];
}

// Calculates the real road route between the rider and customer.
// Geoapify returns distance in metres, time in seconds and GeoJSON geometry.
export async function routeDriving(from, to, signal) {
  if (!hasGeoapifyKey) throw new Error("Geoapify routing is not configured.");
  if (!validPoint(from) || !validPoint(to)) {
    throw new Error("Both route locations are required.");
  }

  const waypoints = `${Number(from.lat)},${Number(from.lng)}|${Number(
    to.lat
  )},${Number(to.lng)}`;
  const url =
    `${ROUTING_BASE}?waypoints=${encodeURIComponent(waypoints)}` +
    `&mode=drive&format=geojson&units=metric&type=balanced&apiKey=${KEY}`;

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Road route lookup failed.");

  const data = await response.json();
  const route = data.features?.[0];
  if (!route) throw new Error("No road route was found.");

  return {
    distanceKm: Number(route.properties?.distance || 0) / 1000,
    durationMinutes: Number(route.properties?.time || 0) / 60,
    geometry: routeCoordinates(data),
  };
}
