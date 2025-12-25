const express = require("express");
const axios = require("axios");

const router = express.Router();

// 🔒 FIXED TOKEN (as received from VD)
const VD_TOKEN =
  "uoIRZnliH7EQPcjJA1zqOlJeumCo+MZ3Ay1Hc1KSHRiqD1L/qKV81otQPh25c3U0xlmUWt96BrG9pJzTyqZ6bCclfyW/p4E8iretHY6gS8c=";

/**
 * ✅ TEST 1: Generate Token (already working, kept for reference)
 */
router.post("/token/test", async (req, res) => {
  try {
    const response = await axios.post(
      "http://cards.vdwebapi.com/distributor/api-generatetoken/",
      { distributor_id: "VDIDCashrivo" },
      {
        headers: {
          username: "7855728385794175BF3412882AEECB3C",
          password: "$2BmTiaGF5ABF9B1A42D46069E43F58B",
        },
        timeout: 15000,
      }
    );

    res.json({ success: true, response: response.data });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
      vd_error: err.response?.data || null,
    });
  }
});

/**
 * ✅ TEST 2: Get Brand (USING FIXED TOKEN)
 */
router.post("/brand/test", async (req, res) => {
  try {
    const BrandCode = req.body?.BrandCode ?? "";

    const response = await axios.post(
      "http://cards.vdwebapi.com/distributor/api-getbrand/",
      { BrandCode },
      {
        headers: { token: VD_TOKEN },
        timeout: 15000,
      }
    );

    res.json({ success: true, response: response.data });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
      vd_error: err.response?.data || null,
    });
  }
});


module.exports = router;
