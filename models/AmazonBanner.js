const mongoose = require("mongoose");

const amazonbannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    link: { type: String, default: "", trim: true },
    imageUrl: { type: String, required: true, trim: true },

    // same model, same collection - separate records by platform
    platform: {
      type: String,
      enum: ["website", "app"],
      default: "website",
      index: true,
    },

    // higher priority = show first
    priority: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Amazon Banner", amazonbannerSchema);
