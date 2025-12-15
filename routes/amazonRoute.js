const express = require("express");
const router = express.Router();
const AmazonItemModel = require("../models/AmazonItemModel");
const { searchTrendingIndia, commonKeywordsIndia  } = require("../controller/amazoncontroller");

/**
 * POST /api/save-all
 * Fetches offers via Amazon API controller & saves/upserts to DB
 */
router.post("/save-all", async (req, res) => {
  try {
    const limit = 10;
    const totalKeywords = commonKeywordsIndia.length;
    const totalPages = Math.ceil(totalKeywords / limit);

    console.log(`🚀 Total Pages: ${totalPages}`);

    let totalSaved = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    let totalFetched = 0;

    // LOOP ALL PAGES HERE 🔥
    for (let page = 1; page <= totalPages; page++) {
      console.log(`📄 Fetching Page ${page}`);

      const mockReq = { query: { page, limit } };

      let apiResponse;
      try {
        apiResponse = await new Promise((resolve) => {
          const mockRes = {
            json: (data) => resolve(data),
            status: () => ({
              json: (data) => resolve({ success: false, ...data }),
            }),
          };
          searchTrendingIndia(mockReq, mockRes);
        });
      } catch (err) {
        console.log("❌ fetch error but suppressed:", err.message);
        apiResponse = { items: [] };
      }

      const fetchedItems = apiResponse.items || [];
      totalFetched += fetchedItems.length;

      // SAVE EACH ITEM
      const ops = fetchedItems.map(async (item) => {
        if (!item?.ASIN || !item.Title) return;

        const cleanItem = {
          Keyword: item.Keyword?.trim() || "",
          ASIN: item.ASIN?.trim(),
          Title: item.Title?.trim() || "",
          URL: item.URL?.trim() || "",
          Image: item.Image?.trim() || "",
          Price: item.Price?.trim() || "",
        };

        try {
          const existing = await AmazonItemModel.findOne({
            ASIN: cleanItem.ASIN,
          });
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
          console.error("❌ Save failed:", err.message);
          totalErrors++;
        }
      });

      await Promise.allSettled(ops);
    }

    res.json({
      success: true,
      message: "All pages saved to DB",
      totalFetched,
      totalSaved,
      totalUpdated,
      totalErrors,
    });
  } catch (err) {
    console.error("🔥 Fatal Error:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * GET /api/all-items
 * Fetch all items from database
 */
router.get("/all-items", async (req, res) => {
  try {
    // 🔥 NO SORT → RETURNS EXACT INSERTION ORDER (1 → 192)
    const items = await AmazonItemModel.find();

    res.json({ success: true, totalItems: items.length, items });
  } catch (err) {
    console.error("❌ Failed to fetch items from DB:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});



module.exports = router;
