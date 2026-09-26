const express = require("express");
const { verifyToken } = require("../middleware/auth");
const { saveSubscription, removeSubscription } = require("../services/push");

const router = express.Router();
router.use(verifyToken);

router.post("/subscribe", async (req, res) => {
  const result = await saveSubscription({
    uid: req.user.uid,
    role: req.user.role || "customer",
    subscription: req.body?.subscription,
  });

  res.json({ success: true, data: result });
});

router.delete("/subscribe", async (req, res) => {
  const result = await removeSubscription({
    uid: req.user.uid,
    endpoint: req.body?.endpoint,
  });

  res.json({ success: true, data: result });
});

module.exports = router;
