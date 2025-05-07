const express = require('express');
const router = express.Router();
const axios = require('axios');


router.get("/vcommission", async (req, res) => {
  const apiKey = process.env.VCOMMISSION_API || "68109215875cf93f32c67ac24f36810921587600";
  
  const url = `https://api.vcommission.com/v2/publisher/campaigns?apiKey=${apiKey}`;

  try {
    const response = await axios.get(url);
    const data = response.data;

    res.json(data); // send response to client
  } catch (error) {
    console.error("Error fetching data:", error.message);
    res.status(500).json({ error: "Failed to fetch from vCommission" });
  }
});

module.exports = router;
