const mongoose = require("mongoose");

const homebannerSchema = new mongoose.Schema(
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

module.exports = mongoose.model("Home Banner", homebannerSchema);