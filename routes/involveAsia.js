// routes/involveAsia.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

// Fetch all offers
router.get('/get-involve-asia', async (req, res) => {
  try {
    const response = await axios.post(
      'https://api.involve.asia/api/offers/all',
      {
        page: 1,
        limit: 100,
        sort_by: "relevance",
        "filters[offer_id]": 25,
        "filters[offer_name]": "lazada",
        "filters[offer_country]": "Malaysia",
        "filters[offer_type]": "cpa|cps|cpa_both|cpc|cpm",
        "filters[application_status]": "Approved|Blocked|Pending|Rejected",
        "filters[offer_status]": "Active|Paused",
        "filters[categories]": "Electronics|Fashion|Finance|Health & Beauty|Marketplace|Others|Services|Travel"
      },
      {
        headers: {
          accept: "application/json",
          Authorization: "Bearer 8c39+Gyozpz1aldHRnLIKB+9wwi3PjoZ6791SO9LyzA="
        }
      }
    );

    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error fetching offers:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to fetch offers', error: error.response?.data || error.message });
  }
});

module.exports = router;
