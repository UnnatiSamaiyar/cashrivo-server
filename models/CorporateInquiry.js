const mongoose = require("mongoose");

const CORPORATE_USE_CASES = [
  "Employee Gifting",
  "Employee R&R",
  "Employee Sales Incentive",
  "Employee Dealer Program",
  "Marketing & Promotion",
  "Others",
];

const CorporateInquirySchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    corporateEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 180,
      index: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    location: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "",
    },
    useCase: {
      type: String,
      required: true,
      enum: CORPORATE_USE_CASES,
    },
    otherRequirement: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    mailStatus: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
      index: true,
    },
    mailError: {
      type: String,
      default: "",
    },
    source: {
      type: String,
      default: "corporate-orders-page",
    },
    ipAddress: {
      type: String,
      default: "",
    },
    userAgent: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

CorporateInquirySchema.index({ createdAt: -1 });
CorporateInquirySchema.index({ corporateEmail: 1, createdAt: -1 });

module.exports = mongoose.models.CorporateInquiry || mongoose.model("CorporateInquiry", CorporateInquirySchema);
module.exports.CORPORATE_USE_CASES = CORPORATE_USE_CASES;
