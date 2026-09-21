const { db } = require("../config/firebase");

const number = (value, fallback = 0) => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
};

// Reads settings/public and settings/private from Firestore.
// Anything that is missing falls back to a safe default.
async function getSettings() {
  const settings = {
    isOpen: true,
    flatDeliveryFee: 1500,
    cancelGraceMinutes: 3,
    maxDist: 0, // 0 means no delivery distance limit
    restaurantLocation: null,
    largeTotal: 0, // 0 means this rule is off
    largeItems: 0, // 0 means this rule is off
  };

  if (!db) return settings;

  const [publicDoc, privateDoc] = await Promise.all([
    db.collection("settings").doc("public").get(),
    db.collection("settings").doc("private").get(),
  ]);

  const shared = publicDoc.data() || {};
  const secret = privateDoc.data() || {};
  const place = shared.restaurantLocation;

  settings.isOpen = shared.isOpen !== false;
  settings.flatDeliveryFee = number(shared.flatDeliveryFee, 1500);
  settings.cancelGraceMinutes = number(shared.cancelGraceMinutes, 3);
  settings.maxDist = number(shared.maxDist, 0);
  settings.largeTotal = number(secret.largeTotal, 0);
  settings.largeItems = number(secret.largeItems, 0);

  if (place && Number.isFinite(place.lat) && Number.isFinite(place.lng)) {
    settings.restaurantLocation = { lat: place.lat, lng: place.lng };
  }

  return settings;
}

module.exports = { getSettings };
