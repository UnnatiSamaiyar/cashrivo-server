const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const LaunchpadItem = require("../models/LaunchpadItem");

const router = express.Router();

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "launchpad");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeBase = (path.basename(file.originalname || "image", ext) || "image")
      .replace(/[^a-z0-9-_]/gi, "-")
      .slice(0, 40);
    cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}-${safeBase}${ext}`);
  },
});

// ✅ Accept all image types (svg, webp, png, jpg, jpeg, etc)
const fileFilter = (req, file, cb) => {
  if (file && file.mimetype && file.mimetype.startsWith("image/")) return cb(null, true);
  return cb(new Error("Only image files are allowed (mimetype must start with image/)"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

function safeUnlink(absPath) {
  try {
    if (absPath && fs.existsSync(absPath)) fs.unlinkSync(absPath);
  } catch (_) {}
}

function parseExclusive(v) {
  if (v === undefined || v === null || v === "") return false;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "on";
}

function parsePlatform(v) {
  const s = String(v || "").trim().toLowerCase();
  return s === "app" ? "app" : "website";
}

router.post("/", upload.single("image"), async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const link = String(req.body?.link || "").trim();
    const couponCode = String(req.body?.couponCode || "").trim();
    const exclusive = parseExclusive(req.body?.exclusive);
    const platform = parsePlatform(req.body?.platform);

    if (!name) return res.status(400).json({ success: false, message: "name is required" });
    if (!link) return res.status(400).json({ success: false, message: "link is required" });
    if (!req.file) return res.status(400).json({ success: false, message: "image is required" });

    const url = `/uploads/launchpad/${req.file.filename}`;

    const item = await LaunchpadItem.create({
      name,
      link,
      couponCode,
      exclusive,
      platform,
      image: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url,
      },
    });

    return res.json({ success: true, data: item });
  } catch (err) {
    if (req.file?.filename) safeUnlink(path.join(UPLOAD_DIR, req.file.filename));
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const platform = req.query?.platform ? parsePlatform(req.query.platform) : null;
    const filter = platform ? { platform } : {};
    const items = await LaunchpadItem.find(filter).sort({ createdAt: -1 });
    return res.json({ success: true, data: items });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const item = await LaunchpadItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Not found" });
    return res.json({ success: true, data: item });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
});

router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const item = await LaunchpadItem.findById(req.params.id);
    if (!item) {
      if (req.file?.filename) safeUnlink(path.join(UPLOAD_DIR, req.file.filename));
      return res.status(404).json({ success: false, message: "Not found" });
    }

    const name = req.body?.name !== undefined ? String(req.body.name).trim() : item.name;
    const link = req.body?.link !== undefined ? String(req.body.link).trim() : item.link;
    const couponCode =
      req.body?.couponCode !== undefined ? String(req.body.couponCode).trim() : item.couponCode;
    const exclusive =
      req.body?.exclusive !== undefined ? parseExclusive(req.body.exclusive) : item.exclusive;
    const platform =
      req.body?.platform !== undefined ? parsePlatform(req.body.platform) : (item.platform || "website");

    if (!name) {
      if (req.file?.filename) safeUnlink(path.join(UPLOAD_DIR, req.file.filename));
      return res.status(400).json({ success: false, message: "name is required" });
    }
    if (!link) {
      if (req.file?.filename) safeUnlink(path.join(UPLOAD_DIR, req.file.filename));
      return res.status(400).json({ success: false, message: "link is required" });
    }

    if (req.file) {
      const oldAbs = path.join(UPLOAD_DIR, item.image?.filename || "");
      safeUnlink(oldAbs);

      item.image = {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/launchpad/${req.file.filename}`,
      };
    }

    item.name = name;
    item.link = link;
    item.couponCode = couponCode;
    item.exclusive = exclusive;
    item.platform = platform;

    await item.save();
    return res.json({ success: true, data: item });
  } catch (err) {
    if (req.file?.filename) safeUnlink(path.join(UPLOAD_DIR, req.file.filename));
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const item = await LaunchpadItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Not found" });

    const abs = path.join(UPLOAD_DIR, item.image?.filename || "");
    safeUnlink(abs);

    await LaunchpadItem.deleteOne({ _id: item._id });
    return res.json({ success: true, message: "Deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
});

module.exports = router;
