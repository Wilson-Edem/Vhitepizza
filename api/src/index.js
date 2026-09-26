const path = require("path");

// Must run first so every file below can read the values in api/.env.
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const menuRoutes = require("./routes/menu");
const userRoutes = require("./routes/users");
const quoteRoutes = require("./routes/quote");
const orderRoutes = require("./routes/orders");
const notificationRoutes = require("./routes/notifications");
const paymentWebhookRoutes = require("./routes/paymentWebhook");
const adminRoutes = require("./routes/admin");
const { verifyToken } = require("./middleware/auth");
const { startJobs } = require("./jobs/orders");
const { startPushJobs } = require("./jobs/push");

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({ origin: process.env.WEB_URL || "http://localhost:5173" }));
app.use(
  "/api/v1/payments",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    req.rawBody = req.body;

    try {
      req.body = JSON.parse(req.body.toString("utf8"));
    } catch {
      req.body = {};
    }

    next();
  }
);

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
app.use("/api/v1/quote", quoteRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/payments", paymentWebhookRoutes);
app.use("/api/v1/admin", verifyToken, adminRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Not found." });
});

// Errors with a status below 500 (like "Your cart is empty.") are shown to the
// customer. Anything else is logged and hidden.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = Number(err.status) || 500;

  if (status >= 500) console.error(err);

  res.status(status).json({
    success: false,
    message: status < 500 ? err.message : "Something went wrong.",
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Vhitepizza API running on port ${PORT}`);
  startJobs();
  startPushJobs();
});
