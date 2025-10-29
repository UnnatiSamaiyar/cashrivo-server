const express = require("express");
const router = express.Router();
const AmazonItemModel = require("../models/AmazonItemModel");
// const { searchTrendingIndia } = require("../controller/amazoncontroller");

/**
 * POST /api/save-all
 * Fetches offers via Amazon API controller & saves/upserts to DB
 */
// router.post("/save-all", async (req, res) => {
//   try {
//     console.log("🚀 Fetching trending Amazon offers...");
//     const mockReq = { query: { page: req.query.page || 1, limit: req.query.limit || 10 } };

//     // Use controller function directly
//     let apiResponse;
//     try {
//       apiResponse = await new Promise((resolve, reject) => {
//         const mockRes = {
//           json: (data) => resolve(data),
//           status: (code) => ({
//             json: (data) => reject({ code, data }),
//           }),
//         };
//         searchTrendingIndia(mockReq, mockRes);
//       });
//     } catch (err) {
//       console.error("❌ Error fetching Amazon data:", err);
//       return res.status(500).json({ success: false, error: "Failed to fetch from Amazon API" });
//     }

//     const fetchedItems = apiResponse?.items || [];
//     if (!fetchedItems.length)
//       return res.json({ success: true, message: "No items fetched from Amazon API" });

//     console.log(`📦 Received ${fetchedItems.length} items to save/update from Amazon API.`);

//     let totalSaved = 0;
//     let totalUpdated = 0;
//     let totalErrors = 0;

//     const ops = fetchedItems.map(async (item) => {
//       if (!item?.ASIN || !item.Title) return;

//       const cleanItem = {
//         Keyword: item.Keyword?.trim() || "",
//         ASIN: item.ASIN?.trim(),
//         Title: item.Title?.trim() || "",
//         URL: item.URL?.trim() || "",
//         Image: item.Image?.trim() || "",
//         Price: item.Price?.trim() || "",
//         OriginalPrice: item.OriginalPrice?.trim() || "",
//         Discount: item.Discount?.trim() || "",
//         Error: item.Error || "",
//       };

//       try {
//         const existing = await AmazonItemModel.findOne({ ASIN: cleanItem.ASIN });

//         if (existing) {
//           await AmazonItemModel.updateOne({ ASIN: cleanItem.ASIN }, { $set: cleanItem });
//           totalUpdated++;
//         } else {
//           await AmazonItemModel.create(cleanItem);
//           totalSaved++;
//         }
//       } catch (err) {
//         console.error(`❌ Error saving ASIN ${item.ASIN}:`, err.message);
//         totalErrors++;
//       }
//     });

//     await Promise.allSettled(ops);

//     res.json({
//       success: true,
//       message: `✅ Saved ${totalSaved}, updated ${totalUpdated}, errors ${totalErrors}`,
//       totalItemsSaved: totalSaved,
//       totalItemsUpdated: totalUpdated,
//       totalErrors,
//       fetchedCount: fetchedItems.length,
//       fetchedKeywords: apiResponse.keywordsUsed,
//     });
//   } catch (err) {
//     console.error("🔥 Fatal Error in /save-all:", err);
//     res.status(500).json({
//       success: false,
//       error: err.message,
//       stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
//     });
//   }
// });

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
