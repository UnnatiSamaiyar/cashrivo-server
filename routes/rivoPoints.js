"use strict";

const express = require("express");
const auth = require("../middleware/auth");
const User = require("../models/User");
const RivoPointTransaction = require("../models/RivoPointTransaction");

const router = express.Router();

// GET /api/rivo/me -> current balance + recent transactions
router.get("/me", auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const user = await User.findById(userId).select("name email phone userId rivoPoints createdAt");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const items = await RivoPointTransaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.json({
      success: true,
      balance: Number(user.rivoPoints || 0),
      user,
      items,
    });
  } catch (e) {
    console.error("rivo/me error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
