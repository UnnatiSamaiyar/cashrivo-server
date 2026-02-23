const express = require("express");
const router = express.Router();
const AmazonBanner = require("../models/AmazonBanner");
const getMulterUploader = require("../middleware/upload");

const upload = getMulterUploader("uploads/amazonbanners");

router.get("/amazon-banners-get", async (req, res) => {
  try {
    const banners = await AmazonBanner.find()
      .sort({ priority: 1 }); // ✅ 1 = ascending (1,2,3,4)
    res.json(banners);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/amazon-banners-post", upload.single("image"), async (req, res) => {
  try {
    const { title, description, link, priority } = req.body; // ✅ changed

    if (!req.file) return res.status(400).json({ error: "Image is required" });

    const banner = new AmazonBanner({
      title,
      description,
      link,
      priority: Number(priority) || 1, 
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
    const { title, description, link, priority } = req.body; // ✅ changed

    const updateData = {
      title,
      description,
      link,
      priority: Number(priority) || 1, // ✅ NEW
    };

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
