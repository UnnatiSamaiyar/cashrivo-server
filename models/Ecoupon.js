const mongoose = require("mongoose");

const ecouponSchema = new mongoose.Schema(
  {
    srNo: {
      type: String,
      default: "",
      trim: true,
    },
    proposition: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    couponCode: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    validity: {
      type: String,
      default: "",
      trim: true,
    },
    sold: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    purchasedAt: {
      type: Date,
      default: null,
    },
    purchasedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    razorpayOrderId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      default: "",
      trim: true,
      sparse: true,
      index: true,
    },
    purchaseAmount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

ecouponSchema.index({ proposition: 1, isActive: 1, sold: 1 });
ecouponSchema.index({ proposition: 1, purchasedByUserId: 1 });

module.exports = mongoose.model("Ecoupon", ecouponSchema);
