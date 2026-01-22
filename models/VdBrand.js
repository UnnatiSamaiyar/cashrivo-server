// models/VdBrand.js
const mongoose = require("mongoose");

const VdBrandSchema = new mongoose.Schema(
  {
    BrandCode: { type: String, index: true },
    BrandName: { type: String, default: "" },
    Brandtype: { type: String, default: "" },
    Discount: { type: String, default: "" },

    minPrice: { type: Number, default: null },
    maxPrice: { type: Number, default: null },
    DenominationList: { type: String, default: "" },

    Category: { type: String, default: "" },
    Description: { type: String, default: "" },
    Images: { type: String, default: "" },
    TnC: { type: String, default: "" },

    ImportantInstruction: { type: Object, default: null },
    RedeemSteps: { type: Array, default: [] },

    // raw brand object as received
    raw: { type: Object, default: {} },
  },
  { timestamps: true }
);

// Optional: prevent duplicates per BrandCode
VdBrandSchema.index({ BrandCode: 1 }, { unique: false });

module.exports = mongoose.model("VdBrand", VdBrandSchema);
