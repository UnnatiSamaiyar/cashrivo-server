const express = require('express');
const axios = require('axios');
const router = express.Router();

const ACCOUNT_SID = 'IRzdWkXuxBGq5880617PJ55P28HHkxpxg1';
const AUTH_TOKEN = 'ZvbH~ZD.rvovswDBUC2EcWyXy7zmyHNt'; // Keep this secure!
const base64Auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');

router.get('/impact/campaigns', async (req, res) => {
  try {
    const response = await axios.get(`https://api.impact.com/Mediapartners/${ACCOUNT_SID}/Campaigns`, {
      headers: {
        Authorization: `Basic ${base64Auth}`,
        Accept: 'application/json',
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching campaigns:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch campaigns from Impact.com' });
  }
});

router.get('/impact/campaigns/:campaignId', async (req, res) => {
  const { campaignId } = req.params;

  try {
    const response = await axios.get(`https://api.impact.com/Mediapartners/${ACCOUNT_SID}/Campaigns/${campaignId}`, {
      headers: {
        Authorization: `Basic ${base64Auth}`,
        Accept: 'application/json',
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error(`Error fetching campaign ${campaignId}:`, error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch campaign details from Impact.com' });
  }
});


module.exports = router;
