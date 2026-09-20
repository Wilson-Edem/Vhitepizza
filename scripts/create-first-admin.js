// Gives an existing user a role (default: admin).
// The person must sign up in the app first.
// Run from the api folder:
//   node scripts/create-first-admin.js you@example.com
//   node scripts/create-first-admin.js cook@example.com kitchen

const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { auth, db, FieldValue } = require("../api/src/config/firebase");

const ROLES = ["admin", "kitchen", "rider", "customer"];

async function main() {
  const [email, role = "admin"] = process.argv.slice(2);

  if (!email || !ROLES.includes(role)) {
    console.log(
      "Usage: node scripts/create-first-admin.js <email> [admin|kitchen|rider|customer]"
    );
    process.exit(1);
  }

  if (!auth || !db) {
    console.error("Firebase Admin is not ready. Check FIREBASE_KEY_FILE in api/.env.");
    process.exit(1);
  }

  const user = await auth.getUserByEmail(email);

  await auth.setCustomUserClaims(user.uid, { role });
  await db
    .collection("users")
    .doc(user.uid)
    .set({ role, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  console.log(
    `${email} is now ${role}. They must sign out and sign in again to get the new role.`
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
