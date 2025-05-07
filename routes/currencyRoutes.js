// routes/currencyRoutes.js
const express = require("express");
const axios = require("axios");
const router = express.Router();

// Get exchange rates from USD to all supported currencies
router.get("/currency-rates", async (req, res) => {
  try {
    const base = req.query.base || 'USD';
    const response = await axios.get(`https://api.exchangerate.host/latest?base=${base}`);
    res.json(response.data);
  } catch (err) {
    console.error("Currency API Error:", err.message);
    res.status(500).json({ error: "Failed to fetch exchange rates" });
  }
});

module.exports = router;
