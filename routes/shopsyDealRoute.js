const express = require("express");
const router = express.Router();
const ShopsyDeals = require("../models/ShopsyDeals");
const getMulterUploader = require("../middleware/upload");

const upload = getMulterUploader("uploads/shopsydeals");

router.get("/shopsy-banners-get", async (req, res) => {
  try {
    const banners = await ShopsyDeals.find().sort({ createdAt: -1 });
    res.json(banners);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/shopsy-banners-post", upload.single("image"), async (req, res) => {
  try {
    const { title, description, link } = req.body;

    if (!req.file) return res.status(400).json({ error: "Image is required" });

    const banner = new ShopsyDeals({
      title,
      description,
      link,
      imageUrl: `/uploads/shopsydeals/${req.file.filename}`,
    });

    await banner.save();
    res.status(201).json(banner);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/shopsy-banners-edit/:id", upload.single("image"), async (req, res) => {
  try {
    const { title, description, link } = req.body;

    const updateData = { title, description, link };

    if (req.file) {
      updateData.imageUrl = `/uploads/shopsydeals/${req.file.filename}`;
    }

    const banner = await ShopsyDeals.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });

    if (!banner) return res.status(404).json({ error: "Banner not found" });

    res.json(banner);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/shopsy-banners-delete/:id", async (req, res) => {
  try {
    const banner = await ShopsyDeals.findByIdAndDelete(req.params.id);
    if (!banner) return res.status(404).json({ error: "Banner not found" });

    res.json({ message: "Banner deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
