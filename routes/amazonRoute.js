const express = require('express');
const router = express.Router();
const axios = require('axios');
const AmazonItemModel = require('../models/AmazonItemModel');

// Example: GET /api/amazon/item?asin=B0969KGM9B
// router.get('/item', amazonController.getItem);

// router.get('/trending', amazonController.searchTrendingIndia);

router.post("/save-all", async (req, res) => {
  try {
    const limit = 10;
    let page = 1;

    // Pehle first page fetch karo to get totalKeywords
    const firstRes = await axios.get(`http://localhost:5000/api/trending?page=1&limit=${limit}`);
    const totalKeywords = firstRes.data.totalKeywords;
    const totalPages = Math.ceil(totalKeywords / limit);

    let totalSaved = 0;

    // Loop through all pages
    for (page = 1; page <= totalPages; page++) {
      const resPage = await axios.get(`http://localhost:5000/api/trending?page=${page}&limit=${limit}`);
      const items = resPage.data.items;

      // Save each page's items to DB immediately
      if (items.length > 0) {
        await AmazonItemModel.insertMany(items);
        totalSaved += items.length;
        console.log(`Page ${page} saved: ${items.length} items`);
      }
    }

    res.json({ success: true, totalItemsSaved: totalSaved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/all-items", async (req, res) => {
  try {
    const items = await AmazonItemModel.find().sort({ Keyword: 1 }); // optional: sort by Keyword
    res.json({ success: true, totalItems: items.length, items });
  } catch (err) {
    console.error("Failed to fetch items from DB:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


module.exports = router;
