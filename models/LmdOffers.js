const mongoose = require("mongoose");

const LmdOfferSchema = new mongoose.Schema(
  {
    lmd_id: Number,
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
    status: { type: String, default: "active" },
    start_date: Date,
    end_date: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("LmdOffer", LmdOfferSchema);
