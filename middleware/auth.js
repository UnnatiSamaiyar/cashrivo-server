const jwt = require("jsonwebtoken");

/**
 * Minimal JWT auth middleware.
 * Accepts:
 *  - Authorization: Bearer <token>
 *  - token: <token> (header)
 */
module.exports = function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const token = bearer || (req.headers.token ? String(req.headers.token) : "");

    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ success: false, message: "JWT_SECRET missing" });
    }

    const decoded = jwt.verify(token, secret);
    req.user = decoded; // { id, email, userId }
    return next();
  } catch (e) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
};
