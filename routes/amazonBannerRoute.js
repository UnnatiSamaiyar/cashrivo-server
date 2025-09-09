const express = require("express");
const router = express.Router();
const AmazonBanner = require("../models/AmazonBanner");
const getMulterUploader = require("../middleware/upload");

const upload = getMulterUploader("uploads/amazonbanners");

router.get("/amazon-banners-get", async (req, res) => {
  try {
    const banners = await AmazonBanner.find().sort({ createdAt: -1 });
    res.json(banners);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/amazon-banners-post", upload.single("image"), async (req, res) => {
  try {
    const { title, description, link } = req.body;

    if (!req.file) return res.status(400).json({ error: "Image is required" });

    const banner = new AmazonBanner({
      title,
      description,
      link,
      imageUrl: `/uploads/amazonbanners/${req.file.filename}`,
    });

    await banner.save();
    res.status(201).json(banner);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/amazon-banners-edit/:id", upload.single("image"), async (req, res) => {
  try {
    const { title, description, link } = req.body;

    const updateData = { title, description, link };

    if (req.file) {
      updateData.imageUrl = `/uploads/amazonbanners/${req.file.filename}`;
    }

    const banner = await AmazonBanner.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });

    if (!banner) return res.status(404).json({ error: "Banner not found" });

    res.json(banner);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/amazon-banners-delete/:id", async (req, res) => {
  try {
    const banner = await AmazonBanner.findByIdAndDelete(req.params.id);
    if (!banner) return res.status(404).json({ error: "Banner not found" });

    res.json({ message: "Banner deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
