// models/VdStore.js
const mongoose = require("mongoose");

const VdStoreSchema = new mongoose.Schema(
  {
    BrandCode: { type: String, index: true },
    StoreCode: { type: String, index: true },
    StoreName: { type: String, default: "" },

    City: { type: String, default: "" },
    State: { type: String, default: "" },
    Address: { type: String, default: "" },
    Pincode: { type: String, default: "" },

    Phone: { type: String, default: "" },
    Email: { type: String, default: "" },

    Latitude: { type: String, default: "" },
    Longitude: { type: String, default: "" },

    raw: { type: Object, default: {} },
  },
  { timestamps: true }
);

// dedupe-ish index (not strict unique because vendors sometimes repeat)
VdStoreSchema.index({ BrandCode: 1, StoreCode: 1 });

module.exports = mongoose.model("VdStore", VdStoreSchema);
