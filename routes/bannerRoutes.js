const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const getMulterUploader = require('../middleware/upload');
const Banner = require('../models/bannerModel');

const upload = getMulterUploader('uploads/banners');

// CREATE
router.post('/upload-banner', upload.single('image'), async (req, res) => {
  try {
    const { title, altText, link } = req.body;
    const imageUrl = `/uploads/banners/${req.file.filename}`;

    const banner = new Banner({ title, altText, link, imageUrl });
    await banner.save();

    res.status(201).json({ message: 'Banner uploaded successfully', banner });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// READ
router.get("/get-banners", async (req, res) => {
  try {
    const banners = await Banner.find();
    res.status(200).json(banners);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});

// UPDATE
router.put("/update-banner/:id", upload.single("image"), async (req, res) => {
  try {
    const { title, altText, link } = req.body;
    const banner = await Banner.findById(req.params.id);

    if (!banner) return res.status(404).json({ message: "Banner not found" });

    // Delete old image if new one uploaded
    if (req.file && banner.imageUrl) {
      const oldPath = path.join(__dirname, "..", "uploads", "banners", banner.imageUrl);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    banner.title = title || banner.title;
    banner.altText = altText || banner.altText;
    banner.link = link || banner.link;
    if (req.file) banner.imageUrl = req.file.filename;

    await banner.save();

    res.status(200).json({ message: "Banner updated", banner });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE
router.delete("/delete-banner/:id", async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.status(404).json({ message: "Banner not found" });

    // Delete image from filesystem
    const imagePath = path.join(__dirname, "..", "uploads", "banners", banner.imageUrl);
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);

    await Banner.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Banner deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
