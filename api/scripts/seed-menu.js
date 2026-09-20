// Loads api/scripts/menu.json into Firestore.
// Run from the api folder:  node scripts/seed-menu.js
// Running it again resets the menu collections to match menu.json.

const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { db } = require("../src/config/firebase");

async function main() {
  if (!db) {
    console.error("Firebase Admin is not ready. Check FIREBASE_KEY_FILE in api/.env.");
    process.exit(1);
  }

  const menu = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "menu.json"), "utf8")
  );

  const batch = db.batch();

  const put = (collection, items) =>
    items.forEach((item, index) => {
      const { id, ...data } = item;

      batch.set(db.collection(collection).doc(id), { ...data, sortOrder: index });
    });

  put("categories", menu.categories);
  put("products", menu.products);
  put("crusts", menu.options.crusts);
  put("cheeses", menu.options.cheeses);
  put("toppings", menu.options.toppings);

  // Adds the sizes list without touching the other store settings.
  batch.set(
    db.collection("settings").doc("public"),
    { sizes: menu.sizes },
    { merge: true }
  );

  await batch.commit();

  console.log(
    `Menu loaded: ${menu.categories.length} categories, ${menu.products.length} products, ` +
      `${menu.options.crusts.length} crusts, ${menu.options.cheeses.length} cheeses, ` +
      `${menu.options.toppings.length} toppings.`
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
