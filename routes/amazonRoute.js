const express = require("express");
const router = express.Router();
const AmazonItemModel = require("../models/AmazonItemModel");

/**
 * POST /api/save-all
 * - If req.body.items provided → upsert those
 * - If no req.body.items → reload existing DB items and ensure consistency
 */
router.post("/save-all", async (req, res) => {
  try {
    const incomingItems = Array.isArray(req.body?.items) ? req.body.items : [];
    let totalSaved = 0;
    let totalUpdated = 0;
    let totalErrors = 0;

    // ✅ Case 1: items provided in request body
    if (incomingItems.length > 0) {
      console.log(`📦 Received ${incomingItems.length} items to save/update.`);

      const ops = incomingItems.map(async (item) => {
        if (!item?.ASIN || !item.Title) return;

        const cleanItem = {
          Keyword: item.Keyword?.trim() || "",
          ASIN: item.ASIN?.trim(),
          Title: item.Title?.trim() || "",
          URL: item.URL?.trim() || "",
          Image: item.Image?.trim() || "",
          Price: item.Price?.trim() || "",
          OriginalPrice: item.OriginalPrice?.trim() || "",
          Discount: item.Discount?.trim() || "",
          Error: item.Error || "",
        };

        try {
          const existing = await AmazonItemModel.findOne({ ASIN: cleanItem.ASIN });

          if (existing) {
            await AmazonItemModel.updateOne(
              { ASIN: cleanItem.ASIN },
              { $set: cleanItem }
            );
            totalUpdated++;
          } else {
            await AmazonItemModel.create(cleanItem);
            totalSaved++;
          }
        } catch (err) {
          console.error(`❌ Error saving ASIN ${item.ASIN}:`, err.message);
          totalErrors++;
        }
      });

      await Promise.allSettled(ops);
    }

    // ✅ Case 2: No items provided — fallback behavior
    else {
      console.log("ℹ️ No items provided, refreshing from DB...");
      const dbItems = await AmazonItemModel.find();
      totalUpdated = dbItems.length;
    }

    res.json({
      success: true,
      message: `✅ Saved ${totalSaved}, updated ${totalUpdated}, errors ${totalErrors}`,
      totalItemsSaved: totalSaved,
      totalItemsUpdated: totalUpdated,
      totalErrors,
    });
  } catch (err) {
    console.error("🔥 Fatal Error in /save-all:", err);
    res.status(500).json({
      success: false,
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
});

/**
 * GET /api/all-items
 * Fetch all items from database
 */
router.get("/all-items", async (req, res) => {
  try {
    const items = await AmazonItemModel.find().sort({ Keyword: 1 });
    res.json({ success: true, totalItems: items.length, items });
  } catch (err) {
    console.error("❌ Failed to fetch items from DB:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
