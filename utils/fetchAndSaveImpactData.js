const axios = require('axios');
const ImpactData = require('../models/ImpactData'); // Mongoose model
const xml2js = require('xml2js'); // Required to convert XML to JSON

const ACCOUNT_SID = "IRzdWkXuxBGq5880617PJ55P28HHkxpxg1";
const AUTH_TOKEN = "ZvbH~ZD.rvovswDBUC2EcWyXy7zmyHNt";

const fetchAndSaveImpactData = async () => {
  try {
    const credentials = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');

    const response = await axios.get(`https://api.impact.com/Mediapartners/${ACCOUNT_SID}/Campaigns`, {
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    });

    const xmlData = response.data;

    // Convert XML to JSON
    xml2js.parseString(xmlData, { explicitArray: false }, async (err, result) => {
      if (err) {
        console.error('❌ Error parsing XML:', err);
        return;
      }

      const jsonData = result; // This is the JSON data from the XML
      console.log('✅ XML data converted to JSON:', jsonData);

      // Save the converted JSON data to MongoDB
      await ImpactData.findOneAndUpdate(
        { identifier: 'default' },
        { data: jsonData, lastUpdated: new Date() },
        { upsert: true, new: true }
      );

      console.log('✅ Impact data updated successfully in MongoDB');
    });
  } catch (error) {
    console.error('❌ Failed to fetch Impact data:', error.message);
  }
};

module.exports = fetchAndSaveImpactData;
