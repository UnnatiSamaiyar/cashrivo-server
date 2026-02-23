const mongoose = require("mongoose");

const amazonbannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    link: { type: String },
    imageUrl: { type: String, required: true },

    // ✅ NEW: priority (higher = top)
    priority: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Amazon Banner", amazonbannerSchema);