const mongoose = require("mongoose");

/**
 * TEST-only OTP session store.
 * - Never return OTP in production.
 * - TTL cleanup via expiresAt.
 */
const PhoneOtpSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
    phoneHash: { type: String, index: true, required: true },
    purpose: { type: String, index: true, default: "PHONE_VERIFY" },
    // For UPI binding (optional)
    vpaHash: { type: String, index: true, default: "" },
    bindingId: { type: String, default: "" },
    messageId: { type: String, default: "" },
    otpHash: { type: String, required: true },
    attemptsLeft: { type: Number, default: 5 },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

// TTL index
PhoneOtpSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("PhoneOtpSession", PhoneOtpSessionSchema);
