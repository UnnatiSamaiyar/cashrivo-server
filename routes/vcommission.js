// routes/vcommission.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const Campaign = require("../models/Vcommission"); // adjust path as needed
const getMulterUploader = require("../middleware/upload");

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

router.get("/refresh-vcommission", async (req, res) => {
  try {
    const response = await axios.get(baseUrl);
    const campaigns = response.data?.data?.campaigns;

    if (!Array.isArray(campaigns)) {
      return res.status(500).json({ error: "Invalid campaign format from API" });
    }

    let updatedCount = 0;

    for (const c of campaigns) {
      const existing = await Campaign.findOne({ title: c.title });

      const newData = {
        title: c.title,
        tracking_link: c.tracking_link,
        countries: c.countries,
        category: c.categories
      };

      if (existing) {
        // Preserve logo
        newData.logo = existing.logo;

        await Campaign.findByIdAndUpdate(existing._id, newData);
      } else {
        await Campaign.create(newData);
      }

      updatedCount++;
    }

    res.json({
      success: true,
      message: `${updatedCount} campaigns synced`,
    });

  } catch (error) {
    console.error("Error syncing campaigns:", error.message);
    res.status(500).json({ error: "Failed to sync vCommission data" });
  }
});


router.get("/vcommission/saved", async (req, res) => {
  try {
    const campaigns = await Campaign.find({});
    res.json({
      success: true,
      count: campaigns.length,
      data: campaigns,
    });
  } catch (error) {
    console.error("Error fetching campaigns from DB:", error.message);
    res.status(500).json({ error: "Failed to fetch campaigns from database" });
  }
});

const upload = getMulterUploader("uploads/campaign-logos");

// Edit campaign with optional logo upload
router.put("/edit-vcomm/:id", upload.single("logo"), async (req, res) => {
  try {
    const { title, tracking_link, countries } = req.body;
    const { id } = req.params;

    const updateData = {
      title,
      tracking_link,
      countries: countries?.split(",").map(c => c.trim()), // ensure array format
    };

    // If logo file uploaded
    if (req.file) {
      const logoPath = `/uploads/campaign-logos/${req.file.filename}`;
      updateData.logo = logoPath;
    }

    const updatedCampaign = await Campaign.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!updatedCampaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    res.json({
      success: true,
      message: "Campaign updated successfully",
      data: updatedCampaign,
    });
  } catch (error) {
    console.error("Error updating campaign:", error.message);
    res.status(500).json({ error: "Failed to update campaign" });
  }
});

//Delete route
router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const response = await axios.delete(`${baseUrl}/${id}`);
    res.json({ message: `Deleted record with id ${id}`, data: response.data });
  } catch (error) {
    console.error("Error deleting data:", error.message);
    res.status(500).json({ error: "Failed to delete from vCommission" });
  }
});



// Get campaigns by category
// router.get("/vcommission/category/:category", async (req, res) => {
//   const { category } = req.params;

//   try {
//     const response = await axios.get(baseUrl);
//     const allCampaigns = response.data?.data?.campaigns || [];

//     const filtered = allCampaigns.filter(campaign =>
//       campaign.categories?.some(cat => cat.toLowerCase() === category.toLowerCase())
//     );

//     res.json({ success: true, count: filtered.length, campaigns: filtered });
//   } catch (error) {
//     console.error("Category filter error:", error.message);
//     res.status(500).json({ error: "Failed to fetch by category" });
//   }
// });

// Get campaigns by store (match against title or a derived store name)
// router.get("/vcommission/store/:store", async (req, res) => {
//   const { store } = req.params;

//   try {
//     const response = await axios.get(baseUrl);
//     const allCampaigns = response.data?.data?.campaigns || [];

//     const filtered = allCampaigns.filter(campaign =>
//       campaign.title.toLowerCase().includes(store.toLowerCase())
//     );

//     res.json({ success: true, count: filtered.length, campaigns: filtered });
//   } catch (error) {
//     console.error("Store filter error:", error.message);
//     res.status(500).json({ error: "Failed to fetch by store" });
//   }
// });

module.exports = router;
