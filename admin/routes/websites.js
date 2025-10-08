// routes/websites.js
const express = require("express");
const Website = require("../models/Website");
const { authMiddleware, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// GET /api/websites
router.get("/", authMiddleware, async (req, res) => {
  // both admin and sub-admin can list websites (to choose)
  const sites = await Website.find().lean();
  res.json({ websites: sites });
});

// POST /api/websites  (admin only)
router.post("/", authMiddleware, requireAdmin, async (req, res) => {
  const { name, url, apiBaseUrl, logo } = req.body;
  const site = new Website({ name, url, apiBaseUrl, logo });
  await site.save();
  res.status(201).json({ website: site });
});

module.exports = router;
