const mongoose = require("mongoose");

const BuyerSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    mobile: String,
    address: String,
    city: String,
    state: String,
    pincode: String,
  },
  { _id: false }
);

const GiftcardPurchaseSchema = new mongoose.Schema(
  {
    // Owner user (required for order history). Kept optional for backward compatibility.
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, default: null },

    brandCode: { type: String, index: true },
    brandName: String,

    amount: Number,
    qty: Number,
    totalAmount: Number,

    buyer: BuyerSchema,

    razorpay: {
      order_id: { type: String, index: true },
      payment_id: String,
      signature: String,
    },

    // For PAYMENT_MODE=TEST (no real money). Stored only for idempotent verification.
    testPayment: {
      token: { type: String, default: "" },
      method: { type: String, default: "" }, // e.g., upi
      payer_vpa: { type: String, default: "" },
    },

    // Compliance snapshot (Amazon/Flipkart)
    policy: {
      brandKey: { type: String, default: "NORMAL" },
      monthKey: { type: String, default: "" },
      phoneHash: { type: String, default: "" },
      vpaHash: { type: String, default: "" },
      spendPaise: { type: Number, default: 0 },
      discountPaise: { type: Number, default: 0 },
      _usageCounted: { type: Boolean, default: false },
    },

    status: {
      type: String,
      enum: ["PENDING_PAYMENT", "SUCCESS", "SUCCESS_TEST", "VD_FAILED"],
      default: "PENDING_PAYMENT",
      index: true,
    },

    vdOrder: {
      order_id: { type: String, index: true },
      request_ref_no: { type: String, index: true },
    },

    // Voucher payload returned by VD. Stored encrypted-at-rest.
    vouchers_enc: { type: String, default: "" },
    // Optional masked view for quick list rendering.
    vouchers_masked: { type: mongoose.Schema.Types.Mixed, default: null },

    emailDelivery: {
      sent: { type: Boolean, default: false },
      to: { type: String, default: "" },
      messageId: { type: String, default: "" },
      error: { type: String, default: "" },
      sentAt: { type: Date, default: null },
    },

    vdRaw: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GiftcardPurchase", GiftcardPurchaseSchema);
