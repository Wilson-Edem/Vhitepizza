const fs = require("fs");
const path = require("path");
const { db } = require("../config/firebase");

const FILE_PATH = path.resolve(__dirname, "../../scripts/menu.json");
const CACHE_MS = 60 * 1000;

const DEFAULT_SIZES = [
  { id: "small", label: "Small" },
  { id: "medium", label: "Medium" },
  { id: "large", label: "Large" },
  { id: "regular", label: "Regular" },
];

let cache = null;

const bySort = (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);

// Removes bookkeeping fields so only menu data leaves the server.
const clean = (items) =>
  items
    .sort(bySort)
    // eslint-disable-next-line no-unused-vars
    .map(({ sortOrder, createdAt, updatedAt, ...rest }) => rest);

async function readCollection(name) {
  const snapshot = await db.collection(name).get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function loadFromFirestore() {
  if (!db) return null;

  const [categories, products, crusts, cheeses, toppings, settings] =
    await Promise.all([
      readCollection("categories"),
      readCollection("products"),
      readCollection("crusts"),
      readCollection("cheeses"),
      readCollection("toppings"),
      db.collection("settings").doc("public").get(),
    ]);

  if (!products.length) return null;

  const shared = settings.data() || {};

return {
  sizes: shared.sizes || DEFAULT_SIZES,
  categories: clean(categories),
  products: clean(products),
  options: {
    crusts: clean(crusts),
    cheeses: clean(cheeses),
    toppings: clean(toppings),
  },
  settings: {
    flatDeliveryFee: Number(shared.flatDeliveryFee ?? 1500),
    freeDeliveryEnabled: shared.freeDeliveryEnabled !== false,
    freeDeliveryMin: Number(shared.freeDeliveryMin ?? 2000),
  },
};
}

// Returns { data, source } where source is "firestore" or "file".
async function getMenu() {
  const now = Date.now();

  if (cache && now - cache.at < CACHE_MS) return cache;

  let data = null;
  let source = "firestore";

  try {
    data = await loadFromFirestore();
  } catch (error) {
    console.error("Menu from Firestore failed:", error.message);
  }

  if (!data) {
    data = JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));
    source = "file";
  }

  cache = { at: now, data, source };

  return cache;
}

module.exports = { getMenu };
