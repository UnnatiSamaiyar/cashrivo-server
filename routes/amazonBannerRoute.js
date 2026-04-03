const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const AmazonBanner = require("../models/AmazonBanner");

const uploadDir = path.join(__dirname, "../uploads/amazon-banners");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const safeBase = path
      .basename(file.originalname || "banner", ext)
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .toLowerCase();
    cb(null, `${Date.now()}-${safeBase}${ext}`);
  },
});

const upload = multer({ storage });

const normalizePlatform = (value) =>
  value === "app" ? "app" : "website";

// GET banners
// same route, optional ?platform=app | website
router.get("/amazon-banners-get", async (req, res) => {
  try {
    const platform = normalizePlatform(req.query.platform);

    const banners = await AmazonBanner.find({ platform }).sort({
      priority: -1,
      createdAt: -1,
    });

    return res.json(banners);
  } catch (error) {
    console.error("amazon-banners-get error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// CREATE banner
// same route, send platform in formData
router.post("/amazon-banners-post", upload.single("image"), async (req, res) => {
  try {
    const { title, description, link, priority } = req.body;
    const platform = normalizePlatform(req.body.platform);

    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Image is required" });
    }

    const banner = await AmazonBanner.create({
      title: title.trim(),
      description: description?.trim() || "",
      link: link?.trim() || "",
      priority: Number(priority) || 0,
      platform,
      imageUrl: `/uploads/amazon-banners/${req.file.filename}`,
    });

    return res.json({ success: true, message: "Banner created", banner });
  } catch (error) {
    console.error("amazon-banners-post error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// UPDATE banner
// same route, can update content/image/platform
router.put("/amazon-banners-edit/:id", upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, link, priority } = req.body;
    const platform = normalizePlatform(req.body.platform);

    const existing = await AmazonBanner.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Banner not found" });
    }

    if (typeof title === "string") existing.title = title.trim();
    if (typeof description === "string") existing.description = description.trim();
    if (typeof link === "string") existing.link = link.trim();
    if (priority !== undefined) existing.priority = Number(priority) || 0;
    existing.platform = platform;

    if (req.file) {
      if (existing.imageUrl) {
        const oldFile = path.join(__dirname, "..", existing.imageUrl.replace(/^\//, ""));
        if (fs.existsSync(oldFile)) {
          try {
            fs.unlinkSync(oldFile);
          } catch (unlinkErr) {
            console.warn("old banner delete warning:", unlinkErr.message);
          }
        }
      }
      existing.imageUrl = `/uploads/amazon-banners/${req.file.filename}`;
    }

    await existing.save();

    return res.json({ success: true, message: "Banner updated", banner: existing });
  } catch (error) {
    console.error("amazon-banners-edit error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE banner
router.delete("/amazon-banners-delete/:id", async (req, res) => {
  try {
    const banner = await AmazonBanner.findByIdAndDelete(req.params.id);

    if (!banner) {
      return res.status(404).json({ success: false, message: "Banner not found" });
    }

    if (banner.imageUrl) {
      const filePath = path.join(__dirname, "..", banner.imageUrl.replace(/^\//, ""));
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkErr) {
          console.warn("banner image delete warning:", unlinkErr.message);
        }
      }
    }

    return res.json({ success: true, message: "Banner deleted" });
  } catch (error) {
    console.error("amazon-banners-delete error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
