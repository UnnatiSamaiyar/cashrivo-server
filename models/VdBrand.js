const mongoose = require("mongoose");

/**
 * VdBrand:
 * - Discount = vendor discount coming from VD
 * - customerDiscount = what customer gets (your controllable)
 * - discountUser = admin-set discount % (explicit field for audits/analytics)
 */
const VdBrandSchema = new mongoose.Schema(
  {
    BrandCode: { type: String, index: true },
    BrandName: { type: String, default: "" },
    Brandtype: { type: String, default: "" },

    // vendor discount (from VD)
    Discount: { type: String, default: "" },

    // customer discount (editable). If empty -> fallback to vendor Discount.
    customerDiscount: { type: String, default: "" },

    // ✅ NEW: admin-set user discount % (store what admin entered, in %)
   

    enabled: { type: Boolean, default: true, index: true },
    notes: { type: String, default: "" },

    minPrice: { type: Number, default: null },
    maxPrice: { type: Number, default: null },
    DenominationList: { type: String, default: "" },

    Category: { type: String, default: "" },
    Description: { type: String, default: "" },
    Images: { type: String, default: "" },
    TnC: { type: String, default: "" },

    ImportantInstruction: { type: Object, default: null },
    RedeemSteps: { type: Array, default: [] },

    raw: { type: Object, default: {} },
  },
  { timestamps: true }
);

VdBrandSchema.index({ BrandCode: 1 }, { unique: false });

module.exports = mongoose.model("VdBrand", VdBrandSchema);
