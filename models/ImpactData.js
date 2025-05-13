// models/ImpactData.js
const mongoose = require('mongoose');

const impactDataSchema = new mongoose.Schema({
  identifier: { type: String, default: 'default' },
  data: mongoose.Schema.Types.Mixed,
  lastUpdated: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ImpactData', impactDataSchema);
