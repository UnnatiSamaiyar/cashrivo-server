const express = require("express");
const router = express.Router();
const HomeBanner = require("../../models/app/HomeBannerModel");
const getMulterUploader = require("../../middleware/upload");

const upload = getMulterUploader("uploads/homebanners");

router.get("/home-banners-get", async (req, res) => {
  try {
    const banners = await HomeBanner.find()
      .sort({ priority: 1 }); // ✅ 1 = ascending (1,2,3,4)
    res.json(banners);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/home-banners-post", upload.single("image"), async (req, res) => {
  try {
    const { title, description, link, priority } = req.body; // ✅ changed

    if (!req.file) return res.status(400).json({ error: "Image is required" });

    const banner = new HomeBanner({
      title,
      description,
      link,
      priority: Number(priority) || 1, 
      imageUrl: `/uploads/HomeBanners/${req.file.filename}`,
    });

    await banner.save();
    res.status(201).json(banner);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/home-banners-edit/:id", upload.single("image"), async (req, res) => {
  try {
    const { title, description, link, priority } = req.body;

    const updateData = {
      title,
      description,
      link,
      priority: Number(priority) || 1, 
    };

    if (req.file) {
      updateData.imageUrl = `/uploads/HomeBanners/${req.file.filename}`;
    }

    const banner = await HomeBanner.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });

    if (!banner) return res.status(404).json({ error: "Banner not found" });

    res.json(banner);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/home-banners-delete/:id", async (req, res) => {
  try {
    const banner = await HomeBanner.findByIdAndDelete(req.params.id);
    if (!banner) return res.status(404).json({ error: "Banner not found" });

    res.json({ message: "Banner deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
