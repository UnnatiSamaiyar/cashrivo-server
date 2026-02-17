const mongoose = require("mongoose");

/**
 * Tracks monthly caps per brand per authenticated user.
 * (Phone OTP / VPA binding guardrails removed.)
 *
 * NOTE: Older documents may still contain phoneHash/vpaHash fields; we keep
 * the schema permissive to avoid breaking reads.
 */
const MonthlyBrandUsageSchema = new mongoose.Schema(
  {
    brandKey: { type: String, index: true, required: true },
    monthKey: { type: String, index: true, required: true }, // YYYY-MM (UTC)
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },

    // legacy fields (no longer used)
    phoneHash: { type: String, default: "" },
    vpaHash: { type: String, default: "" },

    spendPaise: { type: Number, default: 0 },
    discountPaise: { type: Number, default: 0 },
    ordersCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Unique per user per brand per month (new)
MonthlyBrandUsageSchema.index({ brandKey: 1, monthKey: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("MonthlyBrandUsage", MonthlyBrandUsageSchema);
