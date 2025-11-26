const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema({
  title: String,
  slug: String,
  description: String,
  featuredImage: String,
  bannerImage: String,
  bannerDesc: String,
  bannerLink: String,
  tags: [String],
  category: String,
  content: String,
  images: [String], 
}, { timestamps: true });

module.exports = mongoose.model("Blog", blogSchema);
