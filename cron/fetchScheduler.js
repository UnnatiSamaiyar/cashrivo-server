// cron/fetchScheduler.js
const cron = require('node-cron');
const fetchAndSaveImpactData = require('../utils/fetchAndSaveImpactData');

// Schedule to run at 8am, 2pm, and 8pm daily
cron.schedule('0 8,14,20 * * *', async () => {
  console.log('⏰ Running scheduled Impact API fetch...');
  await fetchAndSaveImpactData();
});
