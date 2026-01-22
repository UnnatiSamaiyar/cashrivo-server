const mongoose = require("mongoose");

const SeoSchema = new mongoose.Schema(
  {
    page: { type: String, unique: true }, // home, deals, shopsy, etc.

    title: String,
    description: String,
    keywords: [String],

    canonical: String,

    ogTitle: String,
    ogDescription: String,
    ogImage: String,

    twitterTitle: String,
    twitterDescription: String,
    twitterImage: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Seo", SeoSchema);
