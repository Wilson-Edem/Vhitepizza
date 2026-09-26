const crypto = require("crypto");
const webpush = require("web-push");
const { db } = require("../config/firebase");

const COLLECTION = "pushSubscriptions";
let configured = false;

function isConfigured() {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
  );
}

function configure() {
  if (configured) return true;
  if (!isConfigured()) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  configured = true;
  return true;
}

function subscriptionId(uid, endpoint) {
  return crypto
    .createHash("sha256")
    .update(`${uid}:${endpoint}`)
    .digest("hex");
}

function cleanSubscription(subscription) {
  const endpoint = String(subscription?.endpoint || "").trim();
  const p256dh = String(subscription?.keys?.p256dh || "").trim();
  const auth = String(subscription?.keys?.auth || "").trim();

  if (!endpoint || !p256dh || !auth) {
    const error = new Error("A valid push subscription is required.");
    error.status = 400;
    throw error;
  }

  return {
    endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: { p256dh, auth },
  };
}

async function saveSubscription({ uid, role, subscription }) {
  if (!db) throw new Error("Database is not available.");
  const clean = cleanSubscription(subscription);
  const id = subscriptionId(uid, clean.endpoint);

  await db.collection(COLLECTION).doc(id).set(
    {
      uid,
      role: role || "customer",
      subscription: clean,
      updatedAt: new Date(),
    },
    { merge: true }
  );

  return { id, enabled: true };
}

async function removeSubscription({ uid, endpoint }) {
  if (!db) throw new Error("Database is not available.");
  const cleanEndpoint = String(endpoint || "").trim();
  if (!cleanEndpoint) return { removed: false };

  const id = subscriptionId(uid, cleanEndpoint);
  await db.collection(COLLECTION).doc(id).delete();
  return { removed: true };
}

async function sendToRoles(roles, payload) {
  if (!configure() || !db) return { skipped: true, sent: 0, failed: 0 };

  const wantedRoles = [...new Set(roles)].filter(Boolean);
  if (!wantedRoles.length) return { skipped: true, sent: 0, failed: 0 };

  const snap = await db
    .collection(COLLECTION)
    .where("role", "in", wantedRoles)
    .get();

  let sent = 0;
  let failed = 0;
  const removals = [];

  await Promise.all(
    snap.docs.map(async (doc) => {
      const record = doc.data();
      try {
        await webpush.sendNotification(
          record.subscription,
          JSON.stringify(payload),
          { TTL: 60 }
        );
        sent += 1;
      } catch (error) {
        failed += 1;
        if (error.statusCode === 404 || error.statusCode === 410) {
          removals.push(doc.ref.delete());
        } else {
          console.error(`Push notification failed for ${doc.id}:`, error.message);
        }
      }
    })
  );

  await Promise.all(removals);
  return { skipped: false, sent, failed };
}

module.exports = {
  isConfigured,
  saveSubscription,
  removeSubscription,
  sendToRoles,
};
