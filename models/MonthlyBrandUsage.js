const mongoose = require("mongoose");

/**
 * Tracks monthly caps per brand and customer identity.
 * Identity is hashed (phone/vpa) for privacy.
 */
const MonthlyBrandUsageSchema = new mongoose.Schema(
  {
    brandKey: { type: String, index: true, required: true },
    monthKey: { type: String, index: true, required: true }, // YYYY-MM
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },

    phoneHash: { type: String, index: true, required: true },
    vpaHash: { type: String, index: true, required: true },

    spendPaise: { type: Number, default: 0 },
    discountPaise: { type: Number, default: 0 },
    ordersCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

MonthlyBrandUsageSchema.index(
  { brandKey: 1, monthKey: 1, user: 1, phoneHash: 1, vpaHash: 1 },
  { unique: true }
);

module.exports = mongoose.model("MonthlyBrandUsage", MonthlyBrandUsageSchema);
