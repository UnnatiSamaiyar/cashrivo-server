const express = require("express");
const axios = require("axios");

const router = express.Router();

router.post("/convert-link", async (req, res) => {
  try {
    const { deal } = req.body;

    if (!deal) {
      return res.status(400).json({ error: "Deal link is required" });
    }

    const response = await axios.post(
      "https://ekaro-api.affiliaters.in/api/converter/public",
      {
        deal: deal,
        convert_option: "convert_only"
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.EARN_KARO}`,
          "Content-Type": "application/json"
        }
      }
    );

    return res.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error("EarnKaro API Error:", error.response?.data || error.message);

    return res.status(500).json({
      success: false,
      error: "Failed to convert link"
    });
  }
});

module.exports = router;
