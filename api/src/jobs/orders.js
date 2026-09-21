const { db } = require("../config/firebase");
const { getSettings } = require("../services/settings");
const { changeStatus, SYSTEM } = require("../services/orders");

const INTERVAL_MS = 20 * 1000;
const UNPAID_MINUTES = 30;

const toMs = (value) =>
  value && typeof value.toMillis === "function" ? value.toMillis() : null;

// Confirmed orders move to preparing once the cancel grace period has passed.
async function advanceConfirmed() {
  const settings = await getSettings();
  const graceMs = settings.cancelGraceMinutes * 60 * 1000;
  const snapshot = await db
    .collection("orders")
    .where("status", "==", "confirmed")
    .get();

  for (const doc of snapshot.docs) {
    const confirmedAt = toMs(doc.data().confirmedAt);

    if (confirmedAt !== null && Date.now() - confirmedAt >= graceMs) {
      await changeStatus(doc.id, "preparing", SYSTEM).catch(() => {});
    }
  }
}

// Orders that were never paid are cancelled after a while.
async function expireUnpaid() {
  const snapshot = await db
    .collection("orders")
    .where("status", "==", "awaiting_payment")
    .get();

  for (const doc of snapshot.docs) {
    const createdAt = toMs(doc.data().createdAt);

    if (createdAt !== null && Date.now() - createdAt > UNPAID_MINUTES * 60 * 1000) {
      await changeStatus(
        doc.id,
        "cancelled",
        SYSTEM,
        "Payment was not completed."
      ).catch(() => {});
    }
  }
}

function startJobs() {
  if (!db) {
    console.warn("Order jobs are off because the database is not ready.");
    return;
  }

  let running = false;

  const timer = setInterval(async () => {
    if (running) return;

    running = true;

    try {
      await advanceConfirmed();
      await expireUnpaid();
    } catch (error) {
      console.error("Order job failed:", error.message);
    } finally {
      running = false;
    }
  }, INTERVAL_MS);

  timer.unref?.();
}

module.exports = { startJobs };
