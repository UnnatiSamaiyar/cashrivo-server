// models/DirectBrand.js
"use strict";

const mongoose = require("mongoose");

const DirectBrandSchema = new mongoose.Schema(
  {
    // display
    name: { type: String, default: "" },
    slug: { type: String, default: "" }, // optional (for url-friendly id)
    description: { type: String, default: "" },
    category: { type: String, default: "" }, // e.g. Travel, Fashion, Beauty

    // media
    logoUrl: { type: String, default: "" },
    bannerUrl: { type: String, default: "" }, // full-width banner image
    secondaryBannerUrl: { type: String, default: "" }, // optional

    // offer
    couponCode: { type: String, default: "" },
    offerText: { type: String, default: "" }, // e.g. "Flat 15% OFF"
    terms: { type: String, default: "" },

    // redirect / tracking
    redirectUrl: { type: String, default: "" }, // where user goes
    trackingUrl: { type: String, default: "" }, // optional
    isDirect: { type: Boolean, default: true }, // direct-connected flag
    isVerified: { type: Boolean, default: true }, // verified badge

    // priority / visibility
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    priority: { type: Number, default: 0 }, // higher = top
    layoutSize: { type: String, default: "" }, // "large" | "medium" (optional)

    // misc
    tags: { type: [String], default: [] },
    meta: { type: Object, default: {} }, // flexible extra data
  },
  { timestamps: true }
);

DirectBrandSchema.index({ name: 1 });
DirectBrandSchema.index({ category: 1 });
DirectBrandSchema.index({ isActive: 1, isFeatured: 1, priority: -1 });

module.exports =
  mongoose.models.DirectBrand || mongoose.model("DirectBrand", DirectBrandSchema);
