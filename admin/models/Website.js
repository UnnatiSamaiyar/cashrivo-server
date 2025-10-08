// models/Website.js
const mongoose = require("mongoose");

const WebsiteSchema = new mongoose.Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  apiBaseUrl: { type: String }, // optional
  logo: { type: String },
  status: { type: String, enum: ["active","inactive"], default: "active" }
}, { timestamps: true });

module.exports = mongoose.model("Website", WebsiteSchema);
