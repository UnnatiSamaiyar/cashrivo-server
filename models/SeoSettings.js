const mongoose = require("mongoose");

const SeoSettingsSchema = new mongoose.Schema(
  {
    commaSeparatedKeywords: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SeoSettings", SeoSettingsSchema);