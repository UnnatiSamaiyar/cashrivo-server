const mongoose = require("mongoose");

/**
 * Binds a user's verified phone to a UPI VPA.
 * In LIVE, verification should be upgraded to PSP-level payer_vpa validation.
 */
const UserUpiBindingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
    phoneHash: { type: String, index: true, required: true },
    vpa: { type: String, default: "" },
    vpaHash: { type: String, index: true, required: true },
    status: {
      type: String,
      enum: ["PENDING", "VERIFIED", "REVOKED"],
      default: "PENDING",
      index: true,
    },
    verifiedAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

UserUpiBindingSchema.index({ user: 1, vpaHash: 1 }, { unique: true });

module.exports = mongoose.model("UserUpiBinding", UserUpiBindingSchema);
