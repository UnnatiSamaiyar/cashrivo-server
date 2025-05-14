const express = require('express');
const axios = require('axios');
const unzipper = require('unzipper');
const router = express.Router();

router.get('/', async (req, res) => {
  const zipUrl = req.query.url;

  if (!zipUrl) {
    return res.status(400).json({ error: 'Missing ?url= parameter' });
  }

  try {
    const response = await axios({
      method: 'get',
      url: zipUrl,
      responseType: 'stream'
    });

    const images = [];

    response.data
      .pipe(unzipper.Parse())
      .on('entry', function (entry) {
        const fileName = entry.path;
        const ext = fileName.toLowerCase().split('.').pop();

        if (['jpg', 'jpeg', 'png'].includes(ext)) {
          const chunks = [];
          entry.on('data', chunk => chunks.push(chunk));
          entry.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const base64Image = `data:image/${ext};base64,${buffer.toString('base64')}`;
            images.push({ fileName, base64Image });
          });
        } else {
          entry.autodrain(); // Skip non-images
        }
      })
      .on('close', () => {
        res.json({ images });
      });

  } catch (err) {
    console.error('ZIP Fetch Error:', err);
    res.status(500).json({ error: 'Failed to process ZIP file' });
  }
});

module.exports = router;
