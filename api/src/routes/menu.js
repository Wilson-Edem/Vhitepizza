const express = require("express");
const { getMenu } = require("../services/menu");

const router = express.Router();

router.get("/", async (req, res) => {
  const { data, source } = await getMenu();

  res.json({ success: true, data, source });
});

module.exports = router;
