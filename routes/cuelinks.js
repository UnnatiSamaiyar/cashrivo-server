const express = require("express");
const Cuelink = require("../models/Cuelinks");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const router = express.Router();

const API_KEY = process.env.CUELINKS_API_KEY;
if (!API_KEY) {
  console.error("Error: Missing CUELINKS_API_KEY in environment variables.");
  process.exit(1);
}

router.get("/cuelink-all", async (req, res) => {
  const {
    sort_column = "id",
    sort_direction = "asc",
    per_page = 50,
    search_term = "",
    country_id,
  } = req.query;

  let page = 1;
  let allCampaigns = [];
  let hasMore = true;

  try {
    while (hasMore) {
      const url = new URL("https://www.cuelinks.com/api/v2/campaigns.json");
      url.searchParams.append("sort_column", sort_column);
      url.searchParams.append("sort_direction", sort_direction);
      url.searchParams.append("page", page);
      url.searchParams.append("per_page", per_page);
      if (search_term) url.searchParams.append("search_term", search_term);
      if (country_id) url.searchParams.append("country_id", country_id);

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Token token="${API_KEY}"`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // Filter sirf required fields
      const campaigns = data.campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        url: c.url,
        domain: c.domain,
        payout_type: c.payout_type,
        payout: c.payout,
        image: c.image,
        last_modified: c.last_modified,
      }));

      // MongoDB me upsert
      const bulkOps = campaigns.map((c) => ({
        updateOne: {
          filter: { id: c.id },
          update: { $set: c },
          upsert: true,
        },
      }));
      await Cuelink.bulkWrite(bulkOps);

      allCampaigns = allCampaigns.concat(campaigns);

      // Agar next page hai toh page++ kar do
      hasMore = campaigns.length === per_page;
      page++;
    }

    res.json({ success: true, total: allCampaigns.length, campaigns: allCampaigns });
  } catch (err) {
    console.error("Cuelinks API error:", err.message);
    res.status(500).json({ error: "Failed to fetch campaigns", details: err.message });
  }
});


module.exports = router;
