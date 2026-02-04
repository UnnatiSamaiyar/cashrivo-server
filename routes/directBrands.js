// routes/adminDirectBrands.js
"use strict";

const express = require("express");
const mongoose = require("mongoose");
const DirectBrand = require("../models/DirectBrand");

const router = express.Router();

/**
 * GET /api/admin/direct-brands
 * Query:
 *  - q: search in name, offerText, couponCode
 *  - category
 *  - isActive (true/false)
 *  - isFeatured (true/false)
 *  - sort: "priority" | "newest" | "oldest"
 *  - page, limit
 */
router.get("/admin/direct-brands", async (req, res) => {
  try {
    const {
      q = "",
      category = "",
      isActive,
      isFeatured,
      sort = "priority",
      page = "1",
      limit = "20",
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const filter = {};

    if (category) filter.category = String(category);

    const isActiveStr = typeof isActive === "string" ? isActive.trim() : "";
    if (isActiveStr === "true" || isActiveStr === "false") {
      filter.isActive = isActiveStr === "true";
    }

    const isFeaturedStr =
      typeof isFeatured === "string" ? isFeatured.trim() : "";
    if (isFeaturedStr === "true" || isFeaturedStr === "false") {
      filter.isFeatured = isFeaturedStr === "true";
    }

    const search = String(q || "").trim();
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { offerText: { $regex: search, $options: "i" } },
        { couponCode: { $regex: search, $options: "i" } },
      ];
    }

    let sortObj = { priority: -1, updatedAt: -1 };
    if (sort === "newest") sortObj = { createdAt: -1 };
    if (sort === "oldest") sortObj = { createdAt: 1 };

    const [items, total] = await Promise.all([
      DirectBrand.find(filter)
        .sort(sortObj)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      DirectBrand.countDocuments(filter),
    ]);

    res.json({
      ok: true,
      page: pageNum,
      limit: limitNum,
      total,
      items,
    });
  } catch (err) {
    console.error("GET /admin/direct-brands error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

/**
 * GET /api/admin/direct-brands/:id
 */
router.get("/admin/direct-brands/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: "Invalid id" });
    }

    const item = await DirectBrand.findById(id).lean();
    if (!item) return res.status(404).json({ ok: false, message: "Not found" });

    res.json({ ok: true, item });
  } catch (err) {
    console.error("GET /admin/direct-brands/:id error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

/**
 * POST /api/admin/direct-brands
 * Body: any fields (all optional)
 */
router.post("/admin/direct-brands", async (req, res) => {
  try {
    const payload = req.body || {};
    const created = await DirectBrand.create(payload);
    res.status(201).json({ ok: true, item: created });
  } catch (err) {
    console.error("POST /admin/direct-brands error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

/**
 * PATCH /api/admin/direct-brands/:id
 * Body: partial fields to update
 */
router.patch("/admin/direct-brands/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: "Invalid id" });
    }

    const payload = req.body || {};
    // prevent accidental overwrite of _id
    delete payload._id;

    const updated = await DirectBrand.findByIdAndUpdate(
      id,
      { $set: payload },
      { new: true },
    );

    if (!updated)
      return res.status(404).json({ ok: false, message: "Not found" });

    res.json({ ok: true, item: updated });
  } catch (err) {
    console.error("PATCH /admin/direct-brands/:id error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

/**
 * DELETE /api/admin/direct-brands/:id
 */
router.delete("/admin/direct-brands/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: "Invalid id" });
    }

    const deleted = await DirectBrand.findByIdAndDelete(id);
    if (!deleted)
      return res.status(404).json({ ok: false, message: "Not found" });

    res.json({ ok: true, message: "Deleted" });
  } catch (err) {
    console.error("DELETE /admin/direct-brands/:id error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

module.exports = router;
