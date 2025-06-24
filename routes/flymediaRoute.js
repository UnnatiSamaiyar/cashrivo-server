const express = require("express");
const https = require("https");

const router = express.Router();
const axios = require('axios');

router.get("/eflow-coupons", (req, res) => {
  const options = {
    method: "GET",
    hostname: "api.eflow.team",
    path: "/v1/affiliates/couponcodes",
    headers: {
      "Content-Type": "application/json",
      "x-eflow-api-key": "vnpaffbTR5Ovr60kTNDA7g" // ⛔ Replace with process.env.EFLOW_API_KEY in production
    }
  };

  const apiReq = https.request(options, (apiRes) => {
    let data = [];

    apiRes.on("data", (chunk) => {
      data.push(chunk);
    });

    apiRes.on("end", () => {
      const body = Buffer.concat(data).toString();

      try {
        const parsed = JSON.parse(body);
        res.json(parsed);
      } catch (err) {
        res.status(500).json({ error: "Failed to parse coupon response" });
      }
    });
  });

  apiReq.on("error", (err) => {
    res.status(500).json({ error: "Error fetching coupons", details: err.message });
  });

  apiReq.end();
});



// Replace with your actual token
const API_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2ODUxMTMzNWY3ZDZiM2I0ZDcwNWM0NmEiLCJlYXJua2FybyI6IjQ0NDgzMDgiLCJpYXQiOjE3NTAxNDM4NTV9.8NjbYGUisDVfg0F0Vr5wg6fawV7KJSqWpSKQipH8uok';

router.post('/convertDeal', async (req, res) => {
    const { deal } = req.body;

    if (!deal) {
        return res.status(400).json({ error: 'Missing deal field in request body' });
    }

    const data = JSON.stringify({
        deal,
        convert_option: "convert_only"
    });

    const config = {
        method: 'post',
        url: 'https://ekaro-api.affiliaters.in/api/converter/public',
        headers: {
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2ODUxMTMzNWY3ZDZiM2I0ZDcwNWM0NmEiLCJlYXJua2FybyI6IjQ0NDgzMDgiLCJpYXQiOjE3NTAxNDM4NTV9.8NjbYGUisDVfg0F0Vr5wg6fawV7KJSqWpSKQipH8uok', // Replace with your real token or use process.env
            'Content-Type': 'application/json'
        },
        data: data
    };

    try {
        const response = await axios(config);
        res.status(200).json(response.data);
    } catch (error) {
        console.error('Error in deal conversion:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to convert deal' });
    }
});

module.exports = router;


module.exports = router;
