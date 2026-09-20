const path = require("path");

// Must run first so every file below can read the values in api/.env.
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const menuRoutes = require("./routes/menu");
const userRoutes = require("./routes/users");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({ origin: process.env.WEB_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "100kb" }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get("/api/v1/health", (req, res) => {
  res.json({
    success: true,
    service: "vhitepizza-api",
    status: "healthy",
  });
});

app.use("/api/v1/menu", menuRoutes);
app.use("/api/v1/users", userRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Not found." });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: "Something went wrong." });
});

app.listen(PORT, () => {
  console.log(`Vhitepizza API running on port ${PORT}`);
});
