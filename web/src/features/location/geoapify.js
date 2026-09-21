const KEY = import.meta.env.VITE_GEOAPIFY_KEY;
const BASE = "https://api.geoapify.com/v1/geocode";

export const hasGeoapifyKey = Boolean(KEY);

// Same rule the server uses for phone numbers.
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

// Suggests Nigerian addresses while the customer types.
export async function searchPlaces(text, signal) {
  const url =
    `${BASE}/autocomplete?text=${encodeURIComponent(text)}` +
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

// Turns map coordinates into a readable address.
export async function reverseGeocode(lat, lng, signal) {
  const url = `${BASE}/reverse?lat=${lat}&lon=${lng}&format=json&apiKey=${KEY}`;

  const response = await fetch(url, { signal });

  if (!response.ok) throw new Error("Address lookup failed.");

  const data = await response.json();

  return data.results?.[0] ? toPlace(data.results[0]) : null;
}
