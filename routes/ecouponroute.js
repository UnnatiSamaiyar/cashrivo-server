const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const mongoose = require("mongoose");

const Ecoupon = require("../models/Ecoupon");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

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

module.exports = router;
