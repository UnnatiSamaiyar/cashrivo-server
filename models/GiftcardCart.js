// models/GiftcardCart.js
"use strict";

const mongoose = require("mongoose");

const giftcardCartItemSchema = new mongoose.Schema(
  {
    brandCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    qty: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
      default: 1,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true, versionKey: false }
);

const giftcardCartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
      unique: true,
    },
    items: {
      type: [giftcardCartItemSchema],
      default: [],
      validate: {
        validator(items) {
          const maxItems = Math.max(1, Math.min(Number(process.env.MAX_GIFTCARD_CART_ITEMS || 25), 100));
          return Array.isArray(items) && items.length <= maxItems;
        },
        message: "Cart item limit exceeded",
      },
    },
    expiresAt: {
      type: Date,
      index: true,
      default() {
        const ttlDays = Math.max(1, Math.min(Number(process.env.GIFTCARD_CART_TTL_DAYS || 60), 365));
        return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
      },
    },
  },
  { timestamps: true, versionKey: false, collection: "giftcard_carts" }
);

giftcardCartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

giftcardCartSchema.pre("validate", function normalizeCart(next) {
  const now = new Date();
  const ttlDays = Math.max(1, Math.min(Number(process.env.GIFTCARD_CART_TTL_DAYS || 60), 365));

  this.expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  if (Array.isArray(this.items)) {
    this.items.forEach((item) => {
      item.brandCode = String(item.brandCode || "").trim().toUpperCase();
      item.amount = Number(item.amount || 0);
      item.qty = Math.trunc(Number(item.qty || 1));
      item.updatedAt = now;
      if (!item.addedAt) item.addedAt = now;
    });
  }

  next();
});

module.exports = mongoose.models.GiftcardCart || mongoose.model("GiftcardCart", giftcardCartSchema);
