const mongoose = require("mongoose");

const flipkartDealSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  link: { type: String },
  imageUrl: { type: String, required: true }, // uploaded file path
}, { timestamps: true });

module.exports = mongoose.model("Flipkart Deal Banner", flipkartDealSchema);
