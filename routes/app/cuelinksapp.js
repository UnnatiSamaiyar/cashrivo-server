const express = require("express");
const CuelinkApp = require("../../models/app/CuelinkAppModel");
const path = require("path");
const fs = require("fs");
const getMulterUploader = require("../../middleware/upload"); // apne path ke hisaab se adjust karo
const upload = getMulterUploader("uploads/cuelinksApp");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const router = express.Router();

const API_KEY = process.env.CUELINKS_API_KEY;
if (!API_KEY) {
  console.error("Error: Missing CUELINKS_API_KEY in environment variables.");
  process.exit(1);
}

// Cuelinks se saara raw data laane ka API (MongoDB me save nahi hoga, filter bhi nahi hoga)
router.get("/cuelinkapp-all-direct", async (req, res) => {
  const {
    sort_column = "id",
    sort_direction = "asc",
    page = 1,
    search_term = "",
    country_id,
  } = req.query;

  console.log("🔍 Incoming request /cuelink-all-direct");
  console.log("➡️ Query params:", {
    sort_column,
    sort_direction,
    page,
    search_term,
    country_id,
  });

  try {
    // Step 1: URL build
    const url = new URL("https://www.cuelinks.com/api/v2/campaigns.json");
    url.searchParams.append("sort_column", sort_column);
    url.searchParams.append("sort_direction", sort_direction);
    url.searchParams.append("page", page);
    if (search_term) url.searchParams.append("search_term", search_term);
    if (country_id) url.searchParams.append("country_id", country_id);

    console.log("🌐 Final API URL:", url.toString());

    // Step 2: API call
    console.log("📡 Fetching campaigns from Cuelinks...");
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Token token="${API_KEY}"`,
        "Content-Type": "application/json",
      },
    });

    console.log("📩 API response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ API Error Response:", errorText);
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    // Step 3: Parse data (raw, without filtering)
    const data = await response.json();
    console.log("✅ API data received. Campaign count:", data.campaigns.length);

    // Step 4: Directly return full API response
    console.log("📤 Sending raw response to client (no filtering, no DB).");
    res.json({
      success: true,
      page: parseInt(page),
      total: data.campaigns.length,
      data, // full raw response from Cuelinks
    });
  } catch (err) {
    console.error("🔥 Error in /cuelink-all-direct route:", err.message);
    res
      .status(500)
      .json({ error: "Failed to fetch campaigns", details: err.message });
  }
});

// Cuelinks se campaigns laane ka simple API (logging ke sath)
router.get("/cuelinkapp-all", async (req, res) => {
 const {
  sort_column = "id",
  sort_direction = "asc",
  page = 1,
  search_term = "",
  country_id,
} = req.query;


  console.log("🔍 Incoming request /cuelink-all");
  console.log("➡️ Query params:", {
    sort_column,
    sort_direction,
    page,
    search_term,
    country_id,
  });

  try {
    // Step 1: URL build
    const url = new URL("https://www.cuelinks.com/api/v2/campaigns.json");
    url.searchParams.append("sort_column", sort_column);
    url.searchParams.append("sort_direction", sort_direction);
    url.searchParams.append("page", page);
    if (search_term) url.searchParams.append("search_term", search_term);
    if (country_id) url.searchParams.append("country_id", country_id);

    console.log("🌐 Final API URL:", url.toString());

    // Step 2: API call
    console.log("📡 Fetching campaigns from Cuelinks...");
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Token token="${API_KEY}"`,
        "Content-Type": "application/json",
      },
    });

    console.log("📩 API response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ API Error Response:", errorText);
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    // Step 3: Parse data
    const data = await response.json();
    console.log("✅ API data received. Campaign count:", data.campaigns.length);

    // Step 4: Filter required fields
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

    console.log("📝 Filtered campaigns:", campaigns.length);

    // Step 5: MongoDB upsert
    const bulkOps = campaigns.map((c) => ({
      updateOne: {
        filter: { id: c.id },
        update: { $set: c },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      console.log("💾 Writing to MongoDB. Operations:", bulkOps.length);
      await CuelinkApp.bulkWrite(bulkOps);
      console.log("✅ MongoDB upsert complete.");
    } else {
      console.log("⚠️ No campaigns found to write in DB.");
    }

    // Step 6: Send response
    console.log("📤 Sending response to client.");
    res.json({
      success: true,
      page: parseInt(page),
      total: campaigns.length,
      campaigns,
    });
  } catch (err) {
    console.error("🔥 Error in /cuelink-all route:", err.message);
    res
      .status(500)
      .json({ error: "Failed to fetch campaigns", details: err.message });
  }
});

// Get campaigns directly from MongoDB
router.get("/cuelinkapp-db", async (req, res) => {
  try {
    console.log("📡 Fetching all campaigns from MongoDB...");

    const campaigns = await CuelinkApp.find({}); // saara data laayega
    const total = await CuelinkApp.countDocuments({});

    console.log(`✅ Total campaigns fetched: ${total}`);

    res.json({
      success: true,
      total,
      campaigns,
    });
  } catch (err) {
    console.error("🔥 MongoDB fetch error:", err.message);
    res.status(500).json({
      error: "Failed to fetch campaigns from DB",
      details: err.message,
    });
  }
});

router.put("/edit-cuelinkapp/:id", upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url } = req.body;

    console.log(`Editing campaign with id: ${id}`);

    // Pehle record nikal lo
    const campaign = await CuelinkApp.findById(id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    // Agar naya image aaya hai to purana delete kardo
    if (req.file) {
      if (campaign.image) {
        const oldPath = path.join(__dirname, "..", campaign.image);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      // Naya image ka path save karo
      campaign.image = path.join("uploads/cuelinks", req.file.filename);
    }

    // Name aur URL update karo
    campaign.name = name || campaign.name;
    campaign.url = url || campaign.url;

    const updatedCampaign = await campaign.save();

    console.log("✅ Campaign updated:", updatedCampaign._id);

    res.json({
      success: true,
      message: "Campaign updated successfully",
      campaign: updatedCampaign,
    });
  } catch (err) {
    console.error("🔥 Edit error:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to edit campaign",
      details: err.message,
    });
  }
});

// DELETE: ek campaign delete karne ke liye
router.delete("/delete-cuelinkapp/:id", async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`Deleting campaign with id: ${id}`);

    const deletedCampaign = await CuelinkApp.findByIdAndDelete(id);

    if (!deletedCampaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    console.log("✅ Campaign deleted:", deletedCampaign._id);

    res.json({
      success: true,
      message: "Campaign deleted successfully",
      deletedCampaign,
    });
  } catch (err) {
    console.error("🔥 Delete error:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to delete campaign",
      details: err.message,
    });
  }
});

module.exports = router;
