const express = require("express");
const axios = require("axios");

const router = express.Router();

router.post("/token/test", async (req, res) => {
  try {
    const response = await axios.post(
      "http://cards.vdwebapi.com/distributor/api-generatetoken/",
      {
        distributor_id: "VDIDCashrivo",
      },
      {
        headers: {
          username: "7855728385794175BF3412882AEECB3C",
          password: "$2BmTiaGF5ABF9B1A42D46069E43F58B",
        },
        timeout: 15000,
      }
    );

    res.json({
      success: true,
      response: response.data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
      vd_error: err.response?.data || null,
    });
  }
});

module.exports = router;
