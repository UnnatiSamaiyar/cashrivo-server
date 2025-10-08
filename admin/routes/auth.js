// routes/auth.js
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

// POST /api/auth/login
// body: { user_role, email, password }
// user_role in login form - we validate that the user exists with that role
router.post("/login", async (req, res) => {
  try {
    const { user_role, email, password } = req.body;
    if (!email || !password || !user_role) {
      return res.status(400).json({ message: "role, email and password required" });
    }

    const user = await User.findOne({ email: email.toLowerCase(), user_role });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    // create token payload
    const payload = { id: user._id, email: user.email, user_role: user.user_role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "12h" });

    // optionally set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 12 * 3600 * 1000
    });

    const userSafe = {
      id: user._id,
      email: user.email,
      user_role: user.user_role,
      websites_access: user.websites_access
    };

    return res.json({ token, user: userSafe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/auth/me
router.get("/me", authMiddleware, (req, res) => {
  // req.user set by authMiddleware
  res.json({ user: req.user });
});

module.exports = router;
