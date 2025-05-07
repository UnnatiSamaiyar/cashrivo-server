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

router.get("/get-coupons", async (req, res) => {
  try {
    const coupons = await Coupon.find();
    res.status(200).json(coupons);
  } catch (error) {
    console.log(error);
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
  
        res.status(200).json({ message: "Coupon updated successfully", updatedCoupon });
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
  
     
      if (deletedCoupon.image) fs.unlinkSync(`uploads/coupons/${deletedCoupon.image}`);
      if (deletedCoupon.storeLogo) fs.unlinkSync(`uploads/coupons/${deletedCoupon.storeLogo}`);
  
      res.status(200).json({ message: "Coupon deleted successfully" });
    } catch (error) {
      console.error("Coupon DELETE failed:", error.message);
      res.status(500).json({ error: "Failed to delete coupon" });
    }
  });
    

module.exports = router;
