// models/Campaign.js
const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  title: { type: String, required: true },
  tracking_link: { type: String, required: true },
  countries: { type: [String], required: true },
  logo: String,
});

module.exports = mongoose.model('Vcommission', campaignSchema);
