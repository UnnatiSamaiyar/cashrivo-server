const express = require("express");
const SeoSettings = require("../models/SeoSettings");

const router = express.Router();

// GET /api/admin/seo-settings
router.get("/admin/seo-settings", async (req, res) => {
  try {
    let doc = await SeoSettings.findOne();
    if (!doc) doc = await SeoSettings.create({ commaSeparatedKeywords: "" });
    return res.json(doc);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch SEO settings" });
  }
});

// PUT /api/admin/seo-settings
router.put("/admin/seo-settings", async (req, res) => {
  try {
    const { commaSeparatedKeywords = "" } = req.body || {};
    const value = String(commaSeparatedKeywords).trim();

    let doc = await SeoSettings.findOne();
    if (!doc) doc = await SeoSettings.create({ commaSeparatedKeywords: value });
    else {
      doc.commaSeparatedKeywords = value;
      await doc.save();
    }

    return res.json(doc);
  } catch (err) {
    return res.status(500).json({ message: "Failed to update SEO settings" });
  }
});

module.exports = router;