const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  title: String,
  altText: String,
  link: String,
  imageUrl: String, // this will store the filename or full path
  code: String,     // optional field
}, { timestamps: true });

module.exports = mongoose.model('Banner', bannerSchema);
