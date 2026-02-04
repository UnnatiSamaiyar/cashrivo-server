
"use strict";
const mongoose = require("mongoose");

const PhoneOtpSessionSchema = new mongoose.Schema(
  {
    phone: { type: String, index: true },
    otpHash: String,
    expiresAt: Date,
    attempts: { type: Number, default: 0 },
    vpaHash: String,
    messageId: String,
    bindingId: String,
  },
  { timestamps: true }
);

PhoneOtpSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model("PhoneOtpSession", PhoneOtpSessionSchema);
