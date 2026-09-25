const express = require("express");
const { z } = require("zod");
const { db, auth, FieldValue } = require("../config/firebase");
const { requireRole } = require("../middleware/auth");
const { HttpError } = require("../utils/errors");
const { parse } = require("../validators/order");

const router = express.Router();

router.use(requireRole("admin"));

const availabilitySchema = z.object({ available: z.boolean() });
const staffSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(["admin", "kitchen", "rider", "customer"]),
});

// Turns a menu item's "sold out" state on or off.
router.patch("/products/:id", async (req, res) => {
  if (!db) throw new HttpError(503, "Database is not available.");

  const { available } = parse(availabilitySchema, req.body);
  const ref = db.collection("products").doc(req.params.id);

  if (!(await ref.get()).exists) throw new HttpError(404, "Product not found.");

  await ref.update({ available, updatedAt: FieldValue.serverTimestamp() });

  res.json({ success: true, data: { id: req.params.id, available } });
});

// Every account, for the admin Users screen.
router.get("/users", async (req, res) => {
  if (!db) throw new HttpError(503, "Database is not available.");

  const { role } = req.query;
  let query = db.collection("users");

  if (role && ["admin", "kitchen", "rider", "customer"].includes(role)) {
    query = query.where("role", "==", role);
  }

  const snapshot = await query.limit(500).get();

  res.json({
    success: true,
    data: snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() })),
  });
});

// Lists everyone with a staff role.
router.get("/staff", async (req, res) => {
  if (!db) throw new HttpError(503, "Database is not available.");

  const snapshot = await db
    .collection("users")
    .where("role", "in", ["admin", "kitchen", "rider"])
    .get();

  res.json({
    success: true,
    data: snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() })),
  });
});

// Gives an existing account a staff role.
router.post("/staff", async (req, res) => {
  if (!db || !auth) throw new HttpError(503, "Database is not available.");

  const { email, role } = parse(staffSchema, req.body);
  const record = await auth
    .getUserByEmail(email)
    .catch(() => {
      throw new HttpError(404, "No account found with this email. They must sign up first.");
    });

  await auth.setCustomUserClaims(record.uid, { role });
  await db
    .collection("users")
    .doc(record.uid)
    .set({ role, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  res.json({ success: true, data: { uid: record.uid, email, role } });
});

router.patch("/staff/:uid/active", async (req, res) => {
  if (!db) throw new HttpError(503, "Database is not available.");

  const { available: active } = parse(availabilitySchema, {
    available: req.body?.active,
  });

  await db
    .collection("users")
    .doc(req.params.uid)
    .set({ active }, { merge: true });

  res.json({ success: true, data: { uid: req.params.uid, active } });
});

// Same as above, for the Users tab (covers every role).
router.patch("/users/:uid/active", async (req, res) => {
  if (!db) throw new HttpError(503, "Database is not available.");

  const { available: active } = parse(availabilitySchema, {
    available: req.body?.active,
  });

  await db
    .collection("users")
    .doc(req.params.uid)
    .set({ active }, { merge: true });

  res.json({ success: true, data: { uid: req.params.uid, active } });
});

// ---------- Settings ----------

const settingsSchema = z.object({
  isOpen: z.boolean().optional(),
  flatDeliveryFee: z.number().int().min(0).optional(),
  freeDeliveryEnabled: z.boolean().optional(),
  freeDeliveryMin: z.number().int().min(0).optional(),
});

router.get("/settings", async (req, res) => {
  if (!db) throw new HttpError(503, "Database is not available.");

  const snap = await db.collection("settings").doc("public").get();
  res.json({ success: true, data: snap.data() || {} });
});

router.patch("/settings", async (req, res) => {
  if (!db) throw new HttpError(503, "Database is not available.");

  const patch = parse(settingsSchema, req.body);

  if (Object.keys(patch).length === 0) {
    throw new HttpError(400, "Nothing to update.");
  }

  const ref = db.collection("settings").doc("public");
  const snap = await ref.get();

  if (!snap.exists) {
    await ref.set(patch);
  } else {
    await ref.update(patch);
  }

  res.json({ success: true, data: patch });
});

module.exports = router;
