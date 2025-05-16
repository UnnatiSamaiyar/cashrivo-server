const express = require('express');
const router = express.Router();
const Coupon = require('../models/CSVCoupon'); // Adjust path if needed

function parseDate(dateStr) {
  if (!dateStr) return null;

  const [datePart, timePart = '00:00'] = dateStr.split(' ');
  const [day, month, year] = datePart.split('-');

  // Construct ISO date string: "yyyy-mm-ddThh:mm:ss"
  const isoString = `${year}-${month}-${day}T${timePart}:00`;

  const dateObj = new Date(isoString);
  return isNaN(dateObj.getTime()) ? null : dateObj;
}

router.post('/import-coupons', async (req, res) => {
  try {
    const coupons = req.body.coupons;

    if (!Array.isArray(coupons)) {
      return res.status(400).json({ success: false, message: 'Coupons should be an array' });
    }

    const processedCoupons = coupons.map(coupon => {
      let campaignIds = [];
      if (typeof coupon.campaign_ids === 'string') {
        try {
          campaignIds = JSON.parse(coupon.campaign_ids);
          if (!Array.isArray(campaignIds)) campaignIds = [];
        } catch {
          campaignIds = coupon.campaign_ids.split(',').map(id => Number(id.trim())).filter(Boolean);
        }
      } else if (Array.isArray(coupon.campaign_ids)) {
        campaignIds = coupon.campaign_ids.map(id => Number(id)).filter(Boolean);
      }

      let campaigns = [];
      if (typeof coupon.campaigns === 'string') {
        try {
          campaigns = JSON.parse(coupon.campaigns);
          if (!Array.isArray(campaigns)) campaigns = [];
        } catch {
          campaigns = [];
        }
      } else if (Array.isArray(coupon.campaigns)) {
        campaigns = coupon.campaigns;
      }

      return {
        code: coupon.code,
        campaign_ids: campaignIds,
        campaigns: campaigns,
        startDate: parseDate(coupon.startDate),
        endDate: parseDate(coupon.endDate),
        type: coupon.type,
        status: coupon.status || 'active',
        app_rej_by: coupon.app_rej_by || null,
        rej_reason: coupon.rej_reason || null,
        description: coupon.description || '',
      };
    });

    await Coupon.insertMany(processedCoupons);

    return res.status(200).json({ success: true, message: 'Coupons imported and saved successfully' });
  } catch (error) {
    console.error('Error importing coupons:', error);
    return res.status(500).json({ success: false, message: 'Failed to import coupons' });
  }
});

// GET all coupons
router.get('/all-coupons', async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }); // latest first
    res.status(200).json({ success: true, data: coupons });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch coupons' });
  }
});

const getMulterUploader = require('../middleware/upload'); // adjust path as needed
const upload = getMulterUploader('uploads/csvcoupons'); // create a specific folder if you want

// Edit route
router.put('/edit-coupon/:id', upload.fields([
  { name: 'company_logo', maxCount: 1 },
  { name: 'offer_image', maxCount: 1 }
]), async (req, res) => {
  try {
    const couponId = req.params.id;
    const {
      code, campaign_ids, campaigns, startDate, endDate,
      type, status, app_rej_by, rej_reason, description, tc, link, category 
    } = req.body;

    const updateFields = {
      ...(code && { code }),
      ...(type && { type }),
      ...(status && { status }),
      ...(app_rej_by && { app_rej_by }),
      ...(rej_reason && { rej_reason }),
      ...(description && { description }),
      ...(tc && {tc}),
      ...(link && {link}),
      ...(category && {category})
    };

    if (campaign_ids) {
      try {
        updateFields.campaign_ids = Array.isArray(campaign_ids)
          ? campaign_ids.map(id => Number(id)).filter(Boolean)
          : JSON.parse(campaign_ids);
      } catch {
        updateFields.campaign_ids = campaign_ids.split(',').map(id => Number(id.trim())).filter(Boolean);
      }
    }

    if (campaigns) {
      try {
        updateFields.campaigns = Array.isArray(campaigns)
          ? campaigns
          : JSON.parse(campaigns);
      } catch {
        updateFields.campaigns = campaigns.split(',').map(c => c.trim());
      }
    }

    if (startDate) updateFields.startDate = parseDate(startDate);
    if (endDate) updateFields.endDate = parseDate(endDate);

    // Handle uploaded files
    if (req.files.company_logo && req.files.company_logo[0]) {
      updateFields.company_logo = `/uploads/csvcoupons/${req.files.company_logo[0].filename}`;
    }

    if (req.files.offer_image && req.files.offer_image[0]) {
      updateFields.offer_image = `/uploads/csvcoupons/${req.files.offer_image[0].filename}`;
    }

    const updatedCoupon = await Coupon.findByIdAndUpdate(
      couponId,
      { $set: updateFields },
      { new: true }
    );

    if (!updatedCoupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    res.status(200).json({ success: true, data: updatedCoupon, message: 'Coupon updated successfully' });
  } catch (error) {
    console.error('Error updating coupon:', error);
    res.status(500).json({ success: false, message: 'Failed to update coupon' });
  }
});




module.exports = router;
