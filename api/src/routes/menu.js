const express = require("express");
const menu = require("../../scripts/menu.json");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    data: menu,
  });
});

module.exports = router;