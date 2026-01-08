const express = require("express");
const { syncAll, syncNew, syncUpdated } = require("../services/couponmatedServices");
const Coupon = require("../models/CouponMated");

const router = express.Router();

/**
 * Manual trigger: fetch /coupons/all and upsert to MongoDB
 * GET /api/coupomated/sync/all
 */
router.get("/sync/all", async (req, res) => {
  try {
    const result = await syncAll();
    return res.json({ success: true, ...result });
  } catch (err) {
    // ✅ show real reason
    const axiosStatus = err?.response?.status;
    const axiosData = err?.response?.data;
    const code = err?.code;
    const msg = err?.message;

    console.error("COUPOMATED SYNC ERROR:", {
      code,
      msg,
      axiosStatus,
      axiosData: typeof axiosData === "string" ? axiosData.slice(0, 500) : axiosData,
      stack: err?.stack,
    });

    return res.status(500).json({
      success: false,
      message: msg || "Sync failed",
      code: code || null,
      axiosStatus: axiosStatus || null,
    });
  }
});


/**
 * Optional manual triggers (useful for testing cron behavior)
 * GET /api/coupomated/sync/new
 * GET /api/coupomated/sync/updated
 */
router.get("/sync/new", async (req, res) => {
  try {
    const result = await syncNew();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err?.message || "Sync failed" });
  }
});

router.get("/sync/updated", async (req, res) => {
  try {
    const result = await syncUpdated();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err?.message || "Sync failed" });
  }
});

router.get("/list", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.merchant) {
      filter.merchant_name = new RegExp(req.query.merchant, "i");
    }

    if (req.query.category) {
      filter.category_names = new RegExp(req.query.category, "i");
    }

    if (req.query.exclusive !== undefined) {
      filter.exclusive = String(req.query.exclusive);
    }

    const [data, total] = await Promise.all([
      Coupon.find(filter)
        .sort({ updated_at: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Coupon.countDocuments(filter),
    ]);

    res.json({
      success: true,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      data,
    });
  } catch (err) {
    console.error("DB LIST ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch coupons",
    });
  }
});

module.exports = router;
