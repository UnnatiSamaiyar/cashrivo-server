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

const GiftRecipientSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    mobile: { type: String, default: "" },
    message: { type: String, default: "" },
  },
  { _id: false }
);

const GiftDeliverySchema = new mongoose.Schema(
  {
    mode: { type: String, enum: ["INSTANT", "SCHEDULED"], default: "INSTANT" },
    scheduled_at: { type: Date, default: null },
    channel: { type: String, enum: ["EMAIL", "MOBILE", "EMAIL_AND_MOBILE", "SELF"], default: "SELF" },
    status: { type: String, enum: ["NOT_REQUIRED", "PENDING", "STORED"], default: "NOT_REQUIRED" },
  },
  { _id: false }
);

const GiftcardPurchaseSchema = new mongoose.Schema(
  {
    // Owner user (required for order history). Kept optional for backward compatibility.
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, default: null },

    // Group id for multi-card (qty) purchases
    groupId: { type: String, index: true, default: "" },

    brandCode: { type: String, index: true },
    brandName: String,

    amount: Number,
    qty: { type: Number, default: 1 },
    totalAmount: Number,

    buyer: BuyerSchema,

    purchase_type: { type: String, enum: ["SELF", "GIFT"], default: "SELF", index: true },
    recipient: { type: GiftRecipientSchema, default: null },
    delivery: { type: GiftDeliverySchema, default: () => ({ mode: "INSTANT", scheduled_at: null, channel: "SELF", status: "NOT_REQUIRED" }) },

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
      usageCountedQty: { type: Number, default: 0 },
    },

    status: {
      type: String,
      enum: ["PENDING_PAYMENT", "SUCCESS", "SUCCESS_TEST", "VD_FAILED", "SUCCESS_PARTIAL"],
      default: "PENDING_PAYMENT",
      index: true,
    },

    vdOrder: {
      order_id: { type: String, index: true },
      request_ref_no: { type: String, index: true },
      receiptNo: { type: String, default: "" },
      // Per-card stable identifiers (for qty > 1 issuance)
      items: { type: [mongoose.Schema.Types.Mixed], default: [] },
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
