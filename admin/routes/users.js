// routes/users.js
const express = require("express");
const User = require("../models/User");
const { authMiddleware, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// POST /api/users
// Admin only: create new user (admin can create admin or sub-admin)
router.post("/", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { user_role, email, password, websites_access } = req.body;
    if (!user_role || !email || !password) return res.status(400).json({ message: "role, email, password required" });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ message: "Email already in use" });

    const newUser = new User({
      user_role,
      email: email.toLowerCase(),
      password,
      websites_access: Array.isArray(websites_access) ? websites_access : []
    });

    await newUser.save();
    const userSafe = { id: newUser._id, email: newUser.email, user_role: newUser.user_role, websites_access: newUser.websites_access };
    res.status(201).json({ user: userSafe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/users - admin only - list users (basic)
router.get("/", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-password").lean();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
