const express = require("express");
const router = express.Router();
const FlipkartDeal = require("../models/FlipkartDeals");
const getMulterUploader = require("../middleware/upload");

const upload = getMulterUploader("uploads/flipkartdeals");

router.get("/flipkart-banners-get", async (req, res) => {
  try {
    const banners = await FlipkartDeal.find().sort({ createdAt: -1 });
    res.json(banners);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/flipkart-banners-post", upload.single("image"), async (req, res) => {
  try {
    const { title, description, link } = req.body;

    if (!req.file) return res.status(400).json({ error: "Image is required" });

    const banner = new FlipkartDeal({
      title,
      description,
      link,
      imageUrl: `/uploads/flipkartdeals/${req.file.filename}`,
    });

    await banner.save();
    res.status(201).json(banner);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/flipkart-banners-edit/:id", upload.single("image"), async (req, res) => {
  try {
    const { title, description, link } = req.body;

    const updateData = { title, description, link };

    if (req.file) {
      updateData.imageUrl = `/uploads/flipkartdeals/${req.file.filename}`;
    }

    const banner = await FlipkartDeal.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });

    if (!banner) return res.status(404).json({ error: "Banner not found" });

    res.json(banner);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/flipkart-banners-delete/:id", async (req, res) => {
  try {
    const banner = await FlipkartDeal.findByIdAndDelete(req.params.id);
    if (!banner) return res.status(404).json({ error: "Banner not found" });

    res.json({ message: "Banner deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
