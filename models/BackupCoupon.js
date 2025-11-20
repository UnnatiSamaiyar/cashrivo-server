// models/BackupCoupon.js
const mongoose = require("mongoose");

const BackupCouponSchema = new mongoose.Schema(
  {
    lmd_id: { type: Number, index: true },
    store: String,
    merchant_homepage: String,
    long_offer: String,
    title: String,
    description: String,
    code: String,
    terms_and_conditions: String,
    categories: [String],
    featured: Boolean,
    publisher_exclusive: String,
    url: String,
    smartlink: String,
    image_url: String,
    type: String,
    offer: String,
    offer_value: String,
    status: { type: String, default: "expired" },
    start_date: Date,
    end_date: Date,

    // meta
    backed_up_at: { type: Date, default: Date.now },
    source_collection: { type: String, default: "LmdOffer" },
    original_createdAt: Date,
    original_updatedAt: Date,
    
  },
  { timestamps: true }
);

module.exports = mongoose.model("BackupCoupon", BackupCouponSchema);
