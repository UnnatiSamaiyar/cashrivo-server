// middleware/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  try {
    let token = null;
    const auth = req.headers.authorization;
    if (auth && auth.startsWith("Bearer ")) token = auth.split(" ")[1];
    else if (req.cookies && req.cookies.token) token = req.cookies.token;

    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // payload contains { id, email, user_role }
    const user = await User.findById(payload.id).select("-password").lean();
    if (!user) return res.status(401).json({ message: "User not found" });

    req.user = user;
    next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ message: "Invalid token" });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (req.user.user_role !== "admin") return res.status(403).json({ message: "Admin only" });
  next();
};

module.exports = { authMiddleware, requireAdmin };
