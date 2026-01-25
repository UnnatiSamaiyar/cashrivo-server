import mongoose from "mongoose";

const SeoSettingsSchema = new mongoose.Schema(
  {
    // Global defaults (site-wide)
    siteName: { type: String, default: "" },
    defaultTitle: { type: String, default: "" },
    defaultDescription: { type: String, default: "" },

    // keywords: store as array for clean handling
    keywords: { type: [String], default: [] },

    // Social / OG
    ogImage: { type: String, default: "" },
    ogType: { type: String, default: "website" },

    // Optional extras
    twitterCard: { type: String, default: "summary_large_image" },
    twitterSite: { type: String, default: "" },

    // Indexing controls
    robots: { type: String, default: "index,follow" },

    // Canonical base (optional)
    canonicalBase: { type: String, default: "" },
  },
  { timestamps: true }
);

// Enforce single doc pattern using a fixed key
SeoSettingsSchema.index({ _id: 1 });

export default mongoose.model("SeoSettings", SeoSettingsSchema);
