const express = require("express");
const router = express.Router();
const LmdOffer = require("../models/LmdOffers"); // adjust path if needed
const BackupCoupon = require("../models/BackupCoupon");
const LmdSyncLog = require("../models/LmdSyncLog");
const getMulterUploader = require("../middleware/upload");
const upload = getMulterUploader("uploads/lmdoffers");

const axios = require("axios");
const cron = require("node-cron");

const LMD_API = process.env.LMD_API;
const format = "json";

function parseDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date && !isNaN(dateStr)) return dateStr;
  const s = String(dateStr).trim();
  const nativeParsed = new Date(s);
  if (!isNaN(nativeParsed.getTime())) return nativeParsed;
  const parts = s.split(/[-\/]/).map((p) => Number(p));
  if (parts.length !== 3) return null;
  let year, month, day;
  if (parts[0] > 31) {
    year = parts[0];
    month = parts[1];
    day = parts[2];
  } else if (parts[2] > 31) {
    day = parts[0];
    month = parts[1];
    year = parts[2];
  } else {
    return null;
  }
  return new Date(year, month - 1, day);
}

// Fetch & insert offers; then move expired offers
async function fetchLMDOffers() {
  const logData = {
    totalFetched: 0,
    inserted: 0,
    status: "success",
    message: "",
  };

  console.log("▶ fetchLMDOffers invoked:", new Date().toISOString());

  if (!LMD_API || !LMD_API.trim()) {
    logData.status = "failed";
    logData.message = "Missing LMD_API";
    console.error("❌ LMD_API not set");
    await safeCreateLog(logData);
    return;
  }

  try {
    let res;
    try {
      res = await axios.get(
        `http://feed.linkmydeals.com/getOffers/?API_KEY=${LMD_API}&incremental=true&format=${format}&off_record=false`,
        { timeout: 20000 }
      );
    } catch (axErr) {
      logData.status = "failed";
      logData.message = `Axios fetch error: ${axErr.message || "unknown"}`;
      console.error("❌ Axios error:", axErr && axErr.message);
      await safeCreateLog(logData);
      return;
    }

    if (!res || !res.data) {
      logData.message = "Empty response from LMD API";
      await safeCreateLog(logData);
      return;
    }

    const offers = Array.isArray(res.data.offers) ? res.data.offers : [];
    logData.totalFetched = offers.length;

    console.log(`   Offers returned: ${offers.length}`);

    if (offers.length === 0) {
      logData.message = "No offers returned";
      await safeCreateLog(logData);
    } else {
      const processedOffers = offers.map((offer) => ({
        lmd_id: Number(offer.lmd_id),
        store: offer.store || "",
        merchant_homepage: offer.merchant_homepage || "",
        long_offer: offer.long_offer || "",
        title: offer.title || "",
        description: offer.description || "",
        code: offer.code || "",
        terms_and_conditions: offer.terms_and_conditions || "",
        categories:
          typeof offer.categories === "string"
            ? offer.categories.split(",").map((c) => c.trim())
            : Array.isArray(offer.categories)
            ? offer.categories
            : [],
        featured: String(offer.featured).toLowerCase() === "yes",
        publisher_exclusive: offer.publisher_exclusive || "N",
        url: offer.url || "",
        smartlink: offer.smartLink || "", // ✅ case fix
        image_url: offer.image_url || "",
        type: offer.type || "",
        offer: offer.offer || "",
        offer_value: offer.offer_value || "",
        status: offer.status || "active",
        start_date: parseDate(offer.start_date),
        end_date: parseDate(offer.end_date),
      }));

      const ops = processedOffers.map((offer) => ({
        updateOne: {
          filter: { lmd_id: offer.lmd_id },
          update: { $set: offer },
          upsert: true,
        },
      }));

      try {
        const bulkRes = await LmdOffer.bulkWrite(ops, { ordered: false });

        const upserted =
          bulkRes.upsertedCount ||
          bulkRes.nUpserted ||
          0;

        logData.inserted = upserted;
        logData.message = `Sync completed. Upserted: ${upserted}`;
        console.log("✅ Bulk upsert completed:", upserted);
      } catch (bulkErr) {
        logData.status = "partial";
        logData.message = `bulkWrite error: ${bulkErr.message || "unknown"}`;
        console.error("❌ bulkWrite error:", bulkErr);
      }

      await safeCreateLog(logData);
    }

    // move expired offers after sync
    try {
      const moveRes = await moveExpiredOffers();
      console.log("▶ moveExpiredOffers result:", moveRes);
    } catch (moveErr) {
      console.error("❌ moveExpiredOffers failed:", moveErr);
    }
  } catch (err) {
    logData.status = "failed";
    logData.message = err.message || "Unknown error";
    await safeCreateLog(logData);
    console.error("❌ LMD Fetch Error:", err);
  }
}


async function safeCreateLog(data) {
  try {
    await LmdSyncLog.create(data);
  } catch (e) {
    console.error("❌ Failed to write LmdSyncLog:", e && e.message);
  }
}

// Move expired offers in batches, idempotent using upsert
async function moveExpiredOffers(batchSize = 500) {
  const now = new Date();
  console.log("🔎 moveExpiredOffers invoked; now =", now.toISOString());

  const cursor = LmdOffer.find({
    end_date: { $exists: true, $lt: now },
  }).cursor();
  let buffer = [];
  let found = 0;
  let backed = 0;
  let deleted = 0;

  for await (const doc of cursor) {
    found++;
    buffer.push(doc);
    if (buffer.length >= batchSize) {
      const res = await processExpiredBatch(buffer);
      backed += res.backed;
      deleted += res.deleted;
      buffer = [];
    }
  }

  if (buffer.length > 0) {
    const res = await processExpiredBatch(buffer);
    backed += res.backed;
    deleted += res.deleted;
  }

  return { found, backed, deleted };
}

async function processExpiredBatch(docs) {
  if (!docs || docs.length === 0) return { backed: 0, deleted: 0 };

  const ops = docs.map((o) => ({
    updateOne: {
      filter: { lmd_id: o.lmd_id },
      update: {
        $setOnInsert: {
          lmd_id: o.lmd_id,
          store: o.store,
          merchant_homepage: o.merchant_homepage,
          long_offer: o.long_offer,
          title: o.title,
          description: o.description,
          code: o.code,
          terms_and_conditions: o.terms_and_conditions,
          categories: o.categories || [],
          featured: o.featured,
          publisher_exclusive: o.publisher_exclusive,
          url: o.url,
          smartlink: o.smartlink,
          image_url: o.image_url,
          type: o.type,
          offer: o.offer,
          offer_value: o.offer_value,
          status: o.status || "expired",
          start_date: o.start_date,
          end_date: o.end_date,
          backed_up_at: new Date(),
          original_createdAt: o.createdAt,
          original_updatedAt: o.updatedAt,
        },
      },
      upsert: true,
    },
  }));

  const bulkRes = await BackupCoupon.bulkWrite(ops, { ordered: false });
  const backedCount = bulkRes.upsertedCount || bulkRes.nUpserted || 0;

  const lmdIds = docs
    .map((d) => d.lmd_id)
    .filter((id) => typeof id === "number");
  let delRes = { deletedCount: 0 };
  try {
    delRes = await LmdOffer.deleteMany({ lmd_id: { $in: lmdIds } });
  } catch (e) {
    console.error("❌ deleteMany failed:", e && e.message);
  }

  return { backed: backedCount, deleted: delRes.deletedCount || 0 };
}

/* Routes */

router.post("/import-lmdoffers", async (req, res) => {
  try {
    const offers = req.body.offers;
    if (!Array.isArray(offers))
      return res
        .status(400)
        .json({ success: false, message: "Offers should be an array" });

    const processed = offers
      .map((offer) => {
        try {
          return {
            lmd_id: Number(offer.lmd_id) || 0,
            store: offer.store || "",
            merchant_homepage: offer.merchant_homepage || "",
            long_offer: offer.long_offer || "",
            title: offer.title || "",
            description: offer.description || "",
            code: offer.code || "",
            terms_and_conditions: offer.terms_and_conditions || "",
            categories:
              typeof offer.categories === "string"
                ? offer.categories.split(",").map((c) => c.trim())
                : Array.isArray(offer.categories)
                ? offer.categories
                : [],
            featured: String(offer.featured).toLowerCase() === "yes",
            publisher_exclusive: offer.publisher_exclusive || "N",
            url: offer.url || "",
            smartlink: offer.smartlink || "",
            image_url: offer.image_url || "",
            type: offer.type || "",
            offer: offer.offer || "",
            offer_value: offer.offer_value || "",
            status: offer.status || "active",
            start_date: parseDate(offer.start_date),
            end_date: parseDate(offer.end_date),
          };
        } catch (err) {
          return null;
        }
      })
      .filter(Boolean);

    const lmdIds = processed.map((o) => o.lmd_id);
    const existing = await LmdOffer.find(
      { lmd_id: { $in: lmdIds } },
      "lmd_id"
    ).lean();
    const existingIds = new Set(existing.map((e) => e.lmd_id));
    const uniqueOffers = processed.filter((o) => !existingIds.has(o.lmd_id));

    if (uniqueOffers.length === 0)
      return res
        .status(200)
        .json({
          success: true,
          message: "All offers are duplicates. Nothing imported.",
        });

    await LmdOffer.insertMany(uniqueOffers, { ordered: false });
    return res
      .status(200)
      .json({
        success: true,
        message: `${uniqueOffers.length} new offers imported successfully`,
      });
  } catch (error) {
    console.error("Error importing LMD offers:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to import offers" });
  }
});

router.get("/all-lmdoffers", async (req, res) => {
  try {
    const offers = await LmdOffer.find({}).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, data: offers });
  } catch (error) {
    console.error("Error fetching offers:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch offers" });
  }
});

router.get("/backup-lmdoffers", async (req, res) => {
  try {
    const offers = await BackupCoupon.find({}).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, data: offers });
  } catch (error) {
    console.error("Error fetching offers:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch offers" });
  }
});

router.get("/unique-offer-types", async (req, res) => {
  try {
    const uniqueTypes = await LmdOffer.distinct("type");
    const cleanedTypes = uniqueTypes
      .filter((t) => t && t.trim() !== "")
      .sort((a, b) => a.localeCompare(b));
    return res
      .status(200)
      .json({ success: true, count: cleanedTypes.length, data: cleanedTypes });
  } catch (error) {
    console.error("Error fetching unique offer types:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch unique offer types" });
  }
});

router.put(
  "/edit-lmdoffer/:id",
  upload.fields([{ name: "image_url", maxCount: 1 }]),
  async (req, res) => {
    try {
      const offerId = req.params.id;
      const body = req.body;
      const updateFields = {};

      if (body.lmd_id) updateFields.lmd_id = Number(body.lmd_id);
      if (body.store) updateFields.store = body.store;
      if (body.merchant_homepage)
        updateFields.merchant_homepage = body.merchant_homepage;
      if (body.long_offer) updateFields.long_offer = body.long_offer;
      if (body.title) updateFields.title = body.title;
      if (body.description) updateFields.description = body.description;
      if (body.code) updateFields.code = body.code;
      if (body.terms_and_conditions)
        updateFields.terms_and_conditions = body.terms_and_conditions;
      if (body.url) updateFields.url = body.url;
      if (body.smartlink) updateFields.smartlink = body.smartlink;
      if (body.type) updateFields.type = body.type;
      if (body.offer) updateFields.offer = body.offer;
      if (body.offer_value) updateFields.offer_value = body.offer_value;
      if (body.status) updateFields.status = body.status;
      if (body.publisher_exclusive)
        updateFields.publisher_exclusive = body.publisher_exclusive;

      if (body.start_date) updateFields.start_date = parseDate(body.start_date);
      if (body.end_date) updateFields.end_date = parseDate(body.end_date);
      if (body.categories) {
        updateFields.categories =
          typeof body.categories === "string"
            ? body.categories.split(",").map((c) => c.trim())
            : Array.isArray(body.categories)
            ? body.categories
            : [];
      }
      if (body.featured)
        updateFields.featured = body.featured.toLowerCase() === "yes";
      if (req.files && req.files.image_url && req.files.image_url[0])
        updateFields.image_url = `/uploads/lmdoffers/${req.files.image_url[0].filename}`;

      const updatedOffer = await LmdOffer.findByIdAndUpdate(
        offerId,
        { $set: updateFields },
        { new: true }
      );
      if (!updatedOffer)
        return res
          .status(404)
          .json({ success: false, message: "Offer not found" });

      return res
        .status(200)
        .json({
          success: true,
          data: updatedOffer,
          message: "Offer updated successfully",
        });
    } catch (error) {
      console.error("Error updating LMD offer:", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to update offer" });
    }
  }
);

router.get("/fetch-lmdoffers", async (req, res) => {
  await fetchLMDOffers();
  return res.json({ success: true, message: "Manual sync completed" });
});

router.get("/lmd-sync-logs", async (req, res) => {
  try {
    const logs = await LmdSyncLog.find().sort({ createdAt: -1 }).limit(30);
    return res.json({ success: true, logs });
  } catch (err) {
    console.error("Error fetching logs:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch logs" });
  }
});

// Cron: 09:00, 13:00, 18:00 and 01:00 IST
cron.schedule(
  "0 9,13,18,1 * * *",
  () => {
    console.log("▶ Auto Sync Running @ 9,13,18,01 IST");
    fetchLMDOffers();
  },
  { timezone: "Asia/Kolkata" }
);

module.exports = router;
