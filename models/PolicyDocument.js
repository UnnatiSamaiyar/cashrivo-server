const mongoose = require("mongoose");

const POLICY_TYPES = [
  "privacy-policy",
  "terms-of-use",
  "refund-policy",
  "disclaimer",
  "faqs",
];

const PolicyDocumentSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ["website", "app"],
      required: true,
      index: true,
    },
    documentType: {
      type: String,
      enum: POLICY_TYPES,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    summary: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    content: {
      type: String,
      default: "",
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
    lastEditedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

PolicyDocumentSchema.index(
  { platform: 1, documentType: 1 },
  { unique: true, name: "uniq_platform_document_type" }
);

module.exports = mongoose.model("PolicyDocument", PolicyDocumentSchema);
module.exports.POLICY_TYPES = POLICY_TYPES;
