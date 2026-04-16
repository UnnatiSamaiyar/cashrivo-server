const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const mongoose = require("mongoose");
const crypto = require("crypto");
const Razorpay = require("razorpay");

const Ecoupon = require("../models/Ecoupon");
const auth = require("../middleware/auth");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const RAZORPAY_ECOUPON_PRICE = 2;
const RAZORPAY_ECOUPON_AMOUNT_PAISE = 200;
const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
const razorpay =
  razorpayKeyId && razorpayKeySecret
    ? new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret })
    : null;

function normalizeHeader(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getRowValue(row, keys) {
  for (const key of Object.keys(row || {})) {
    const normalized = normalizeHeader(key);
    if (keys.includes(normalized)) {
      return row[key];
    }
  }
  return "";
}

function normalizeCell(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parseBooleanParam(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (String(value).toLowerCase() === "true") return true;
  if (String(value).toLowerCase() === "false") return false;
  return undefined;
}

function slugify(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getOfferBySlug(slug) {
  const pipeline = [
    {
      $group: {
        _id: "$proposition",
        total: { $sum: 1 },
        sold: { $sum: { $cond: [{ $eq: ["$sold", true] }, 1, 0] } },
        active: { $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] } },
        available: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$sold", false] },
                  { $eq: ["$isActive", true] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        proposition: "$_id",
        total: 1,
        sold: 1,
        active: 1,
        available: 1,
      },
    },
  ];

  const rows = await Ecoupon.aggregate(pipeline);
  return rows
    .map((row) => ({
      ...row,
      slug: slugify(row.proposition),
      unlockPrice: RAZORPAY_ECOUPON_PRICE,
    }))
    .find((row) => row.slug === slug);
}

router.post("/ecoupons/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Excel file is required" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return res.status(400).json({ success: false, message: "No sheet found in uploaded file" });
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      raw: false,
    });

    if (!rows.length) {
      return res.status(400).json({ success: false, message: "Uploaded sheet is empty" });
    }

    const preparedDocs = [];
    const seenCodes = new Set();
    const skippedRows = [];

    rows.forEach((row, index) => {
      const srNo = normalizeCell(getRowValue(row, ["sr. no.", "sr no.", "sr no", "sr. no", "serial no", "serial number"]));
      const proposition = normalizeCell(getRowValue(row, ["proposition"]));
      const couponCode = normalizeCell(getRowValue(row, ["coupon code", "couponcode", "code"]));
      const validity = normalizeCell(getRowValue(row, ["validity", "expiry", "expiry date"]));

      if (!proposition || !couponCode) {
        skippedRows.push({ row: index + 2, reason: "Missing Proposition or Coupon Code" });
        return;
      }

      const normalizedCode = couponCode.toUpperCase();
      if (seenCodes.has(normalizedCode)) {
        skippedRows.push({ row: index + 2, reason: "Duplicate Coupon Code in file" });
        return;
      }
      seenCodes.add(normalizedCode);

      preparedDocs.push({
        srNo,
        proposition,
        couponCode,
        validity,
        sold: false,
        isActive: true,
        purchasedAt: null,
        purchasedByUserId: null,
        razorpayOrderId: "",
        razorpayPaymentId: "",
        purchaseAmount: 0,
      });
    });

    if (!preparedDocs.length) {
      return res.status(400).json({ success: false, message: "No valid rows found", skippedRows });
    }

    const existingCodes = await Ecoupon.find(
      { couponCode: { $in: preparedDocs.map((item) => item.couponCode) } },
      { couponCode: 1 }
    ).lean();

    const existingSet = new Set(existingCodes.map((item) => String(item.couponCode).toUpperCase()));
    const insertDocs = [];

    for (const doc of preparedDocs) {
      if (existingSet.has(String(doc.couponCode).toUpperCase())) {
        skippedRows.push({ row: null, reason: `Coupon already exists: ${doc.couponCode}` });
        continue;
      }
      insertDocs.push(doc);
    }

    if (!insertDocs.length) {
      return res.status(409).json({
        success: false,
        message: "All coupon codes already exist",
        importedCount: 0,
        skippedCount: skippedRows.length,
        skippedRows,
      });
    }

    const inserted = await Ecoupon.insertMany(insertDocs, { ordered: false });

    return res.status(201).json({
      success: true,
      message: "Ecoupons imported successfully",
      importedCount: inserted.length,
      skippedCount: skippedRows.length,
      skippedRows,
    });
  } catch (error) {
    console.error("Error importing ecoupons:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to import ecoupons",
      error: error.message,
    });
  }
});

router.get("/ecoupons/stats", async (req, res) => {
  try {
    const [total, sold, active, inactive] = await Promise.all([
      Ecoupon.countDocuments(),
      Ecoupon.countDocuments({ sold: true }),
      Ecoupon.countDocuments({ isActive: true }),
      Ecoupon.countDocuments({ isActive: false }),
    ]);

    return res.json({
      success: true,
      data: {
        total,
        sold,
        unsold: total - sold,
        active,
        inactive,
      },
    });
  } catch (error) {
    console.error("Error fetching ecoupon stats:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch ecoupon stats" });
  }
});

router.get("/ecoupons", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200);
    const search = normalizeCell(req.query.search || "");
    const sold = parseBooleanParam(req.query.sold);
    const isActive = parseBooleanParam(req.query.isActive);

    const query = {};

    if (search) {
      query.$or = [
        { proposition: { $regex: search, $options: "i" } },
        { couponCode: { $regex: search, $options: "i" } },
        { srNo: { $regex: search, $options: "i" } },
        { validity: { $regex: search, $options: "i" } },
      ];
    }

    if (typeof sold === "boolean") query.sold = sold;
    if (typeof isActive === "boolean") query.isActive = isActive;

    const [items, total] = await Promise.all([
      Ecoupon.find(query)
        .populate("purchasedByUserId", "_id name email phone userId")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Ecoupon.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("Error fetching ecoupons:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch ecoupons" });
  }
});

router.patch("/ecoupons/:id/active", async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid ecoupon id" });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ success: false, message: "isActive must be boolean" });
    }

    const updated = await Ecoupon.findByIdAndUpdate(
      id,
      { $set: { isActive } },
      { new: true }
    ).populate("purchasedByUserId", "_id name email phone userId");

    if (!updated) {
      return res.status(404).json({ success: false, message: "Ecoupon not found" });
    }

    return res.json({
      success: true,
      message: `Ecoupon ${isActive ? "activated" : "deactivated"} successfully`,
      data: updated,
    });
  } catch (error) {
    console.error("Error updating ecoupon active status:", error);
    return res.status(500).json({ success: false, message: "Failed to update ecoupon active status" });
  }
});

router.get("/ecoupons/public/offers", async (_req, res) => {
  try {
    const offers = await Ecoupon.aggregate([
      {
        $group: {
          _id: "$proposition",
          total: { $sum: 1 },
          sold: { $sum: { $cond: [{ $eq: ["$sold", true] }, 1, 0] } },
          active: { $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] } },
          available: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$sold", false] },
                    { $eq: ["$isActive", true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return res.json({
      success: true,
      data: offers.map((item) => ({
        proposition: item._id,
        slug: slugify(item._id),
        total: item.total,
        sold: item.sold,
        active: item.active,
        available: item.available,
        unlockPrice: RAZORPAY_ECOUPON_PRICE,
      })),
    });
  } catch (error) {
    console.error("Error fetching public ecoupon offers:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch ecoupon offers" });
  }
});

router.get("/ecoupons/my-coupons", auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const items = await Ecoupon.find({ purchasedByUserId: userId, sold: true })
      .sort({ purchasedAt: -1, createdAt: -1 })
      .select("srNo proposition couponCode validity sold isActive purchasedAt")
      .lean();

    return res.json({ success: true, data: items });
  } catch (error) {
    console.error("Error fetching my ecoupons:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch my ecoupons" });
  }
});

router.post("/ecoupons/public/order", auth, async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(500).json({ success: false, message: "Razorpay is not configured" });
    }

    const proposition = normalizeCell(req.body?.proposition);
    if (!proposition) {
      return res.status(400).json({ success: false, message: "Proposition is required" });
    }

    const available = await Ecoupon.countDocuments({ proposition, sold: false, isActive: true });
    if (!available) {
      return res.status(409).json({ success: false, message: "Offer is sold out" });
    }

    const order = await razorpay.orders.create({
      amount: RAZORPAY_ECOUPON_AMOUNT_PAISE,
      currency: "INR",
      receipt: `ecpn_${Date.now()}`,
      notes: {
        proposition,
        userId: String(req.user?.id || ""),
        userRef: String(req.user?.userId || ""),
      },
    });

    return res.json({
      success: true,
      keyId: razorpayKeyId,
      amount: RAZORPAY_ECOUPON_AMOUNT_PAISE,
      currency: "INR",
      proposition,
      order,
    });
  } catch (error) {
    console.error("Error creating ecoupon order:", error);
    return res.status(500).json({ success: false, message: "Failed to create order" });
  }
});

router.post("/ecoupons/public/verify", auth, async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(500).json({ success: false, message: "Razorpay is not configured" });
    }

    const proposition = normalizeCell(req.body?.proposition);
    const razorpay_order_id = normalizeCell(req.body?.razorpay_order_id);
    const razorpay_payment_id = normalizeCell(req.body?.razorpay_payment_id);
    const razorpay_signature = normalizeCell(req.body?.razorpay_signature);

    if (!proposition || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing Razorpay payment fields" });
    }

    const existing = await Ecoupon.findOne({ razorpayPaymentId: razorpay_payment_id })
      .select("srNo proposition couponCode validity sold isActive purchasedAt")
      .lean();

    if (existing) {
      return res.json({
        success: true,
        message: "Coupon already assigned",
        data: existing,
      });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", razorpayKeySecret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Signature verification failed" });
    }

    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (payment.order_id !== razorpay_order_id) {
      return res.status(400).json({ success: false, message: "Order mismatch" });
    }

    if (String(payment.status).toLowerCase() === "authorized") {
      await razorpay.payments.capture(razorpay_payment_id, RAZORPAY_ECOUPON_AMOUNT_PAISE, "INR");
    } else if (String(payment.status).toLowerCase() !== "captured") {
      return res.status(400).json({ success: false, message: "Payment not captured" });
    }

    const assigned = await Ecoupon.findOneAndUpdate(
      {
        proposition,
        sold: false,
        isActive: true,
      },
      {
        $set: {
          sold: true,
          purchasedAt: new Date(),
          purchasedByUserId: req.user.id,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          purchaseAmount: RAZORPAY_ECOUPON_PRICE,
        },
      },
      {
        new: true,
        sort: { createdAt: 1 },
      }
    )
      .select("srNo proposition couponCode validity sold isActive purchasedAt")
      .lean();

    if (!assigned) {
      return res.status(409).json({
        success: false,
        message: "Payment received, but no active coupon is available now",
      });
    }

    return res.json({
      success: true,
      message: "Coupon purchased successfully",
      data: assigned,
    });
  } catch (error) {
    console.error("Error verifying ecoupon payment:", error);
    return res.status(500).json({ success: false, message: "Failed to verify ecoupon payment" });
  }
});

module.exports = router;
