const express = require('express');
const router = express.Router();
const axios = require('axios');

const apiKey = process.env.VCOMMISSION_API || "67efa8eeb7e01645099c665b9ae67efa8eeb7e35";
const baseUrl = `https://api.vcommission.com/v2/publisher/campaigns?apiKey=${apiKey}`;

// Main route: Fetch all campaigns
router.get("/vcommission", async (req, res) => {
  try {
    const response = await axios.get(baseUrl);
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching data:", error.message);
    res.status(500).json({ error: "Failed to fetch from vCommission" });
  }
});

// Get campaigns by category
router.get("/vcommission/category/:category", async (req, res) => {
  const { category } = req.params;

  try {
    const response = await axios.get(baseUrl);
    const allCampaigns = response.data?.data?.campaigns || [];

    const filtered = allCampaigns.filter(campaign =>
      campaign.categories?.some(cat => cat.toLowerCase() === category.toLowerCase())
    );

    res.json({ success: true, count: filtered.length, campaigns: filtered });
  } catch (error) {
    console.error("Category filter error:", error.message);
    res.status(500).json({ error: "Failed to fetch by category" });
  }
});

// Get campaigns by store (match against title or a derived store name)
router.get("/vcommission/store/:store", async (req, res) => {
  const { store } = req.params;

  try {
    const response = await axios.get(baseUrl);
    const allCampaigns = response.data?.data?.campaigns || [];

    const filtered = allCampaigns.filter(campaign =>
      campaign.title.toLowerCase().includes(store.toLowerCase())
    );

    res.json({ success: true, count: filtered.length, campaigns: filtered });
  } catch (error) {
    console.error("Store filter error:", error.message);
    res.status(500).json({ error: "Failed to fetch by store" });
  }
});

module.exports = router;
