const express = require("express");
const { z } = require("zod");
const { db, FieldValue } = require("../config/firebase");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

const bodySchema = z.object({
  displayName: z.string().trim().max(80).optional(),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9+\-\s()]*$/)
    .optional(),
});

const toPublic = (uid, data) => ({
  uid,
  displayName: data.displayName || "",
  email: data.email || "",
  phone: data.phone || "",
  photoURL: data.photoURL || "",
  role: data.role || "customer",
  active: data.active !== false,
  themePreference: data.themePreference || "system",
});

// Creates the user's profile record on first login, and updates it later.
router.post("/me", verifyToken, async (req, res) => {
  if (!db) {
    return res
      .status(503)
      .json({ success: false, message: "Database is not available." });
  }

  const parsed = bodySchema.safeParse(req.body || {});

  if (!parsed.success) {
    return res
      .status(400)
      .json({ success: false, message: "Check your name and phone number." });
  }

  const { displayName = "", phone = "" } = parsed.data;
  const token = req.user;
  const role = token.role || "customer";
  const ref = db.collection("users").doc(token.uid);

  const data = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists) {
      const created = {
        displayName: displayName || token.name || "",
        email: token.email || "",
        phone,
        photoURL: token.picture || "",
        role,
        active: true,
        themePreference: "system",
        createdAt: FieldValue.serverTimestamp(),
      };

      tx.set(ref, created);
      return created;
    }

   const patch = { role };

if (displayName) patch.displayName = displayName;
if (phone) patch.phone = phone;
if (token.picture) patch.photoURL = token.picture;

    tx.set(ref, patch, { merge: true });
    return { ...snap.data(), ...patch };
  });

  if (data.active === false) {
    return res
      .status(403)
      .json({ success: false, message: "This account is disabled." });
  }

  return res.json({ success: true, data: toPublic(token.uid, data) });
});

router.get("/me", verifyToken, async (req, res) => {
  if (!db) {
    return res
      .status(503)
      .json({ success: false, message: "Database is not available." });
  }

  const snap = await db.collection("users").doc(req.user.uid).get();

  if (!snap.exists) {
    return res
      .status(404)
      .json({ success: false, message: "Profile not found." });
  }

  return res.json({ success: true, data: toPublic(req.user.uid, snap.data()) });
});

module.exports = router;
