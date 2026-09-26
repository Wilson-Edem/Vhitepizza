const express = require("express");
const { verifyToken } = require("../middleware/auth");
const { getMenu } = require("../services/menu");
const { getSettings } = require("../services/settings");
const { priceCart } = require("../services/pricing");
const { schemas, parse } = require("../validators/order");

const router = express.Router();

// Returns the server-calculated price for a cart. Prices from the browser
// are ignored; only product ids, sizes, options and quantities are used.
router.post("/", verifyToken, async (req, res) => {
  const { items } = parse(schemas.quote, req.body);

  const [{ data: menu }, settings] = await Promise.all([
    getMenu(),
    getSettings(),
  ]);

  res.json({
    success: true,
    data: priceCart(menu, items, settings.flatDeliveryFee, {
      freeDeliveryEnabled: settings.freeDeliveryEnabled,
      freeDeliveryMin: settings.freeDeliveryMin,
    }),
  });
});

module.exports = router;
