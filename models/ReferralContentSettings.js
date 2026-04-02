const mongoose = require("mongoose");

const referralContentSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "main",
      unique: true,
      index: true,
      immutable: true,
    },
    shareSubject: {
      type: String,
      default: "Join Cashrivo with my referral code",
      trim: true,
    },
    shareMessageTemplate: {
      type: String,
      default:
        "{{referralCode}} is your Cashrivo referral code.\nUse this code during sign up to join Cashrivo through my invite.\nThis referral code works while the invite remains active.\n\nSave smarter with Cashrivo. Buy gift cards, unlock coupons and earn RivoPoints.\nReferral code: {{referralCode}}\n{{playStoreUrl}}",
      trim: true,
    },
    playStoreUrl: {
      type: String,
      default: "",
      trim: true,
    },
    appStoreUrl: {
      type: String,
      default: "",
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    updatedByUserId: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReferralContentSettings", referralContentSettingsSchema);
