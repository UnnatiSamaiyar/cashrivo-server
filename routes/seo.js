const express = require("express");
const router = express.Router();
const Seo = require("../models/Seo");

/**
 * CREATE or UPDATE SEO (Admin use)
 * page required logically, but schema me optional hi rahega
 */
router.post("/save", async (req, res) => {
  try {
    const { page, ...seoData } = req.body;

    if (!page) {
      return res.status(400).json({ message: "page key required" });
    }

    const seo = await Seo.findOneAndUpdate(
      { page },
      { $set: seoData },
      { upsert: true, new: true }
    );

    res.json(seo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET SEO by page (Frontend)
 */
router.get("/:page", async (req, res) => {
  try {
    const seo = await Seo.findOne({ page: req.params.page });

    if (!seo) return res.json(null);

    res.json(seo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET ALL SEO (Admin panel list)
 */
router.get("/", async (req, res) => {
  try {
    const seoList = await Seo.find().sort({ updatedAt: -1 });
    res.json(seoList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE SEO page
 */
router.delete("/:page", async (req, res) => {
  try {
    await Seo.findOneAndDelete({ page: req.params.page });
    res.json({ message: "SEO deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
