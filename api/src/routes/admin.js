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

// Turns a menu item's "sold out" state on or off. Products are cached on the
// server for a minute, so the change can take up to that long to show.
router.patch("/products/:id", async (req, res) => {
  if (!db) throw new HttpError(503, "Database is not available.");

  const { available } = parse(availabilitySchema, req.body);
  const ref = db.collection("products").doc(req.params.id);

  if (!(await ref.get()).exists) throw new HttpError(404, "Product not found.");

  await ref.update({ available, updatedAt: FieldValue.serverTimestamp() });

  res.json({ success: true, data: { id: req.params.id, available } });
});

// Lists everyone with a staff role, for the Staff Accounts screen.
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

// Gives an existing account (they must have signed up already) a staff role.
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

module.exports = router;
