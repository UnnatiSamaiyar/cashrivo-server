const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));


const router = express.Router();

const API_KEY = process.env.CUELINKS_API_KEY;
if (!API_KEY) {
  console.error('Error: Missing CUELINKS_API_KEY in environment variables.');
  process.exit(1);
}

router.get('/cuelink', async (req, res) => {
  const {
    sort_column = 'id',
    sort_direction = 'asc',
    page = 1,
    per_page = 50,
    search_term = '',
    country_id
  } = req.query;

  const url = new URL('https://www.cuelinks.com/api/v2/campaigns.json');
  url.searchParams.append('sort_column', sort_column);
  url.searchParams.append('sort_direction', sort_direction);
  url.searchParams.append('page', page);
  url.searchParams.append('per_page', per_page);
  if (search_term) url.searchParams.append('search_term', search_term);
  if (country_id) url.searchParams.append('country_id', country_id);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Token token="${API_KEY}"`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error('Cuelinks API error:', err.message);
    res.status(500).json({ error: 'Failed to fetch campaigns', details: err.message });
  }
});

module.exports = router;
