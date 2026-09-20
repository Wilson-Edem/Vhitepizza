const fs = require("fs");
const path = require("path");

const {
  initializeApp,
  cert,
  getApps,
} = require("firebase-admin/app");

const {
  getAuth,
} = require("firebase-admin/auth");

const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");

// FIREBASE_KEY_FILE in api/.env is relative to the api folder.
const keyPath = path.resolve(
  __dirname,
  "../..",
  process.env.FIREBASE_KEY_FILE || "./secrets/firebase-service-account.json"
);

let auth = null;
let db = null;

try {
  if (!fs.existsSync(keyPath)) {
    throw new Error(`Key file not found at ${keyPath}`);
  }

  const serviceAccount = JSON.parse(
    fs.readFileSync(keyPath, "utf8")
  );

  const app =
    getApps().length === 0
      ? initializeApp({
          credential: cert(serviceAccount),
        })
      : getApps()[0];

  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase Admin is not ready:", error.message);
}

module.exports = {
  auth,
  db,
  FieldValue,
};