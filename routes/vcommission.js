const express = require('express');
const router = express.Router();
const axios = require('axios');


router.get("/vcommission", async (req, res) => {
  const apiKey = process.env.VCOMMISSION_API || "67efa8eeb7e01645099c665b9ae67efa8eeb7e35";
  
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
