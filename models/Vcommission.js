const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  title: { type: String, required: true },
  tracking_link: { type: String, required: true },
  countries: { type: [String], required: true },
  category: { type: [String], required: true },
  logo: String,
  updated_at: {
    type: String,
    default: () => {
      return new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    }
  }
});

module.exports = mongoose.model('Vcommission', campaignSchema);
