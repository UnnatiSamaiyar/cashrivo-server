const mongoose = require("mongoose");

const amazonItemSchema = new mongoose.Schema({
  Keyword: String,
  ASIN: String,
  Title: String,
  URL: String,
  Image: String,
  Price: String,
  OriginalPrice: String,
  Discount: String,
  Error: String,
});

module.exports = mongoose.model("AmazonItem", amazonItemSchema);
