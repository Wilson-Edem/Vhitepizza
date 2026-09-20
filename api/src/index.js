require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const menuRouter = require("./routes/menu");

const app = express();
const port = process.env.PORT || 5000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/api/v1/health", (req, res) => {
  res.json({
    success: true,
    status: "ok",
  });
});

app.use("/api/v1/menu", menuRouter);

app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

app.listen(port, () => {
  console.log(`Vhitepizza API running on port ${port}`);
});