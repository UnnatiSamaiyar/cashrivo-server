const express = require('express');
const router = express.Router();
const http = require("http");

const lastExtractDatetime = '';
const incremental = true;
const format = 'json';
const offRecord = false;

router.get("/deals", (req, res) => {
  const apiKey = process.env.LMD_API_KEY;
  const lastExtract = lastExtractDatetime ? Math.floor(new Date(lastExtractDatetime).getTime() / 1000) : '';
  
  const url = `http://feed.linkmydeals.com/getOffers/?API_KEY=${apiKey}&incremental=${incremental}&last_extract=${lastExtract}&format=${format}&off_record=${offRecord}`;
  console.log(url);
  
  http.get(url, (response) => {
    let data = "";

    response.on("data", (chunk) => {
      data += chunk;
    });

    response.on("end", () => {
      try {
        const parsed = JSON.parse(data);
        const offers = parsed.offers || [];

        
        res.json(offers);
      } catch (e) {
        console.error("Error parsing response:", e.message);
        res.status(500).json({ error: "Invalid JSON from LinkMyDeals" });
      }
    });
  }).on("error", (err) => {
    console.error("HTTP error:", err.message);
    res.status(500).json({ error: "Failed to fetch from LinkMyDeals" });
  });
});

module.exports = router;