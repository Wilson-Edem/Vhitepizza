const fs = require("fs");
const path = require("path");
const express = require("express");
const { db } = require("../config/firebase");

const router = express.Router();

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

// Removes bookkeeping fields so only menu data goes to the web app.
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

  return {
    sizes: settings.data()?.sizes || DEFAULT_SIZES,
    categories: clean(categories),
    products: clean(products),
    options: {
      crusts: clean(crusts),
      cheeses: clean(cheeses),
      toppings: clean(toppings),
    },
  };
}

router.get("/", async (req, res) => {
  const now = Date.now();

  if (cache && now - cache.at < CACHE_MS) {
    return res.json({ success: true, data: cache.data, source: cache.source });
  }

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

  return res.json({ success: true, data, source });
});

module.exports = router;
