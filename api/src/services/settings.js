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
    freeDeliveryEnabled: true,
freeDeliveryMin: 2000,
    maxDist: 0, // 0 means no delivery distance limit
    restaurantLocation: null,
    // If settings/private has never been created, large-order approval is
    // ON by default (₦25,000 or 6+ items). Create settings/private with
    // largeTotal/largeItems set to 0 to turn the rule off deliberately.
    largeTotal: 25000,
    largeItems: 6,
  };

  if (!db) return settings;

  const [publicDoc, privateDoc] = await Promise.all([
    db.collection("settings").doc("public").get(),
    db.collection("settings").doc("private").get(),
  ]);

  const shared = publicDoc.data() || {};
  const place = shared.restaurantLocation;

  settings.isOpen = shared.isOpen !== false;
  settings.flatDeliveryFee = number(shared.flatDeliveryFee, 1500);
  settings.freeDeliveryEnabled = shared.freeDeliveryEnabled !== false;
settings.freeDeliveryMin = number(shared.freeDeliveryMin, 2000);
  settings.cancelGraceMinutes = number(shared.cancelGraceMinutes, 3);
  settings.maxDist = number(shared.maxDist, 0);

  if (privateDoc.exists) {
    const secret = privateDoc.data() || {};

    settings.largeTotal = number(secret.largeTotal, 0);
    settings.largeItems = number(secret.largeItems, 0);
  }

  if (place && Number.isFinite(place.lat) && Number.isFinite(place.lng)) {
    settings.restaurantLocation = { lat: place.lat, lng: place.lng };
  }

  return settings;
}

module.exports = { getSettings };
