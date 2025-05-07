const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({

  type: String,
  couponName: String,
  url: String,
  code: String,
  startDate: Date,
  endDate: Date,
  verifiedOn: Date,
  storeName: String,
  category: String,
  description: String,
  image: String,
  storeLogo: String,
  couponBanner: String,
  storeUrl: String,
  tagline: String,
});

module.exports = mongoose.model("Coupon", couponSchema);
