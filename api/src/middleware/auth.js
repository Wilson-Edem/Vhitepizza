const { auth } = require("../config/firebase");

// Checks the Firebase login token sent by the web app.
async function verifyToken(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: "Login required." });
  }

  if (!auth) {
    return res
      .status(503)
      .json({ success: false, message: "Login service is not available." });
  }

  try {
    req.user = await auth.verifyIdToken(token);
    return next();
  } catch {
    return res
      .status(401)
      .json({ success: false, message: "Your session has expired." });
  }
}

// Only lets the listed roles through, for example requireRole("admin").
function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.user?.role || "customer";

    if (!roles.includes(role)) {
      return res
        .status(403)
        .json({ success: false, message: "You do not have access." });
    }

    return next();
  };
}

module.exports = { verifyToken, requireRole };
