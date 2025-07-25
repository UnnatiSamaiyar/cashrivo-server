const express = require("express");
const router = express.Router();
const Coupon = require("../models/Coupon");
const getMulterUploader = require("../middleware/upload");
const fs = require("fs");
const upload = getMulterUploader("uploads/coupons");

// POST coupon
router.post(
  "/post-coupon",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "storeLogo", maxCount: 1 },
    { name: "couponBanner", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        type,
        couponName,
        url,
        code,
        startDate,
        endDate,
        verifiedOn,
        storeName,
        category,
        description,
        storeUrl,
        tagline,
      } = req.body;

      const image = req.files["image"]?.[0]?.filename || "";
      const storeLogo = req.files["storeLogo"]?.[0]?.filename || "";
      const couponBanner = req.files["couponBanner"]?.[0]?.filename || "";

      const coupon = new Coupon({
        type,
        couponName,
        url,
        code,
        startDate,
        endDate,
        verifiedOn,
        storeName,
        category,
        description,
        image,
        storeLogo,
        couponBanner,
        storeUrl,
        tagline,
      });

      await coupon.save();
      res.status(201).json({ message: "Coupon posted successfully", coupon });
    } catch (err) {
      console.error("Coupon POST failed:", err);

      res.status(500).json({ error: "Failed to post coupon" });
    }
  }
);

// router.get("/get-coupons", async (req, res) => {
//   try {
//     const coupons = await Coupon.find();
//     res.status(200).json(coupons);
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ message: "Server Error" });
//   }
// });

// READ SINGLE COUPON
router.get("/get-coupon/:id", async (req, res) => {

  try {
    const { id } = req.params;
    const coupons = await Coupon.findById(id);

    if (!coupons) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    res.status(200).json(coupons);
  } catch (error) {
    console.error("Error fetching coupon:", error);
    res.status(500).json({ message: "Server Error" });
  }
})
const axios = require('axios');
router.get('/coupons', async (req, res) => {
  try {
    const response = await axios.post(
      'https://api.involve.asia/api/offers/all',
      {
        page: 1,
        limit: 10,
        // You can filter by advertiser_id, category, country, etc.
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'API-Key': process.env.INVOLVE_API_KEY,
          'API-Secret': process.env.INVOLVE_API_SECRET,
        },
      }
    );

    res.status(200).json(response.data);
  } catch (err) {
    console.error('Error fetching coupons:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
});
// GET coupons by store name
router.get("/get-coupons-by-store/:storeName", async (req, res) => {
  try {
    const { storeName } = req.params;
    const coupons = await Coupon.find({
      storeName: { $regex: new RegExp(`^${storeName}$`, "i") }, // case-insensitive exact match
    });

    if (!coupons.length) {
      return res.status(404).json({ message: "No coupons found for this store" });
    }

    res.status(200).json(coupons);
  } catch (error) {
    console.error("Error fetching store coupons:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// GET coupons by category name
router.get("/get-coupons-by-category/:category", async (req, res) => {
  try {
    const { category } = req.params;
    const coupons = await Coupon.find({
      category: { $regex: new RegExp(`^${category}$`, "i") }, // case-insensitive exact match
    });

    if (!coupons.length) {
      return res.status(404).json({ message: "No coupons found for this store" });
    }

    res.status(200).json(coupons);
  } catch (error) {
    console.error("Error fetching store coupons:", error);
    res.status(500).json({ message: "Server Error" });
  }
});



// PUT: Update coupon by ID
router.put(
  "/update-coupon/:id",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "storeLogo", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const couponId = req.params.id;
      const updates = req.body;

      // Handle optional file updates
      if (req.files["image"]) {
        updates.image = req.files["image"][0].filename;
      }

      if (req.files["storeLogo"]) {
        updates.storeLogo = req.files["storeLogo"][0].filename;
      }

      const updatedCoupon = await Coupon.findByIdAndUpdate(
        couponId,
        { $set: updates },
        { new: true }
      );

      if (!updatedCoupon) {
        return res.status(404).json({ error: "Coupon not found" });
      }

      res
        .status(200)
        .json({ message: "Coupon updated successfully", updatedCoupon });
    } catch (error) {
      console.error("Coupon UPDATE failed:", error.message);
      res.status(500).json({ error: "Failed to update coupon" });
    }
  }
);
// DELETE: Delete coupon by ID
router.delete("/delete-coupon/:id", async (req, res) => {
  try {
    const couponId = req.params.id;
    const deletedCoupon = await Coupon.findByIdAndDelete(couponId);

    if (!deletedCoupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    if (deletedCoupon.image)
      fs.unlinkSync(`uploads/coupons/${deletedCoupon.image}`);
    if (deletedCoupon.storeLogo)
      fs.unlinkSync(`uploads/coupons/${deletedCoupon.storeLogo}`);

    res.status(200).json({ message: "Coupon deleted successfully" });
  } catch (error) {
    console.error("Coupon DELETE failed:", error.message);
    res.status(500).json({ error: "Failed to delete coupon" });
  }
});




module.exports = router;
