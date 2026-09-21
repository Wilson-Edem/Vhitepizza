// Creates a TEST order for an existing user and walks it through the statuses,
// so you can check the server rules against your real Firestore.
// Run from the api folder:
//   node scripts/try-order.js you@example.com
// It needs ALLOW_DEV_PAY=true in api/.env only for the web route; this script
// calls the server code directly. Delete the test order in the Firebase
// console afterwards (Firestore Database > orders).

const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { auth, db } = require("../src/config/firebase");
const {
  createOrder,
  markPaid,
  changeStatus,
  getOrder,
} = require("../src/services/orders");

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.log("Usage: node scripts/try-order.js <email of an existing user>");
    process.exit(1);
  }

  if (!auth || !db) {
    console.error("Firebase Admin is not ready. Check FIREBASE_KEY_FILE in api/.env.");
    process.exit(1);
  }

  const record = await auth.getUserByEmail(email);
  const user = { uid: record.uid, email: record.email, name: record.displayName };
  const admin = { uid: record.uid, role: "admin" };

  const order = await createOrder({
    user,
    items: [
      {
        productId: "chicken-suya-pizza",
        sizeId: "large",
        quantity: 1,
        crustId: "cheese-stuffed-crust",
        cheeseId: "extra-cheese",
        extraToppingIds: ["mushrooms"],
        removedToppingIds: ["red-onions"],
        // The browser could send prices like this, but the server ignores them.
        price: 1,
      },
      { productId: "pepsi-pet-50cl", sizeId: "regular", quantity: 2 },
    ],
    address: {
      formattedAddress: "12 Test Street, Ikeja, Lagos, Nigeria",
      lat: 6.6018,
      lng: 3.3515,
      phone: "08012345678",
      landmark: "Test landmark",
      notes: "Test order, please ignore",
      source: "manual",
    },
  });

  console.log(`Created ${order.orderNumber}: total N${order.pricing.total}`);
  console.log("Expected: 12300 + 2 x 600 + 1500 delivery = N15000");
  console.log(`Status: ${order.status}`);

  const paid = await markPaid(order.id, "try-order-script");

  console.log(`After payment: ${paid.status}`);

  for (const next of ["preparing", "ready", "out_for_delivery", "delivered"]) {
    const current = (await getOrder(order.id, admin)).status;

    if (current === next) continue;

    try {
      const result = await changeStatus(order.id, next, admin);

      console.log(`-> ${result.status}`);
    } catch (error) {
      console.log(`Could not move to ${next}: ${error.message}`);
    }
  }

  console.log("Done. Check the order in Firestore, then delete it.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
