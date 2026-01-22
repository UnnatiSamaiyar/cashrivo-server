// routes/razorpay.routes.js
const express = require("express");
const crypto = require("crypto");
const Razorpay = require("razorpay");

const router = express.Router();

const key_id = process.env.RAZORPAY_KEY_ID;
const key_secret = process.env.RAZORPAY_KEY_SECRET;

if (!key_id || !key_secret) {
  console.warn("⚠️ Razorpay keys missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env");
}

const razorpay = new Razorpay({ key_id, key_secret });

/**
 * Create Order (recommended flow for Checkout)
 * Frontend uses returned order_id in Razorpay Checkout options.
 */
router.post("/create-order", async (req, res) => {
  try {
    const { amount, currency = "INR", receipt, notes } = req.body;

    // amount must be in smallest currency unit (INR => paise)
    // Example: ₹499.00 => amount = 49900
    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount (must be integer in smallest unit)" });
    }

    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: notes || {},
    });

    return res.json({
      success: true,
      order,
      key_id, // safe to send KEY_ID to frontend
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Order creation failed",
      error: err?.error?.description || err?.message || err,
    });
  }
});

/**
 * Verify signature AND capture payment (manual capture)
 * This is the server-side step after Checkout success.
 *
 * Razorpay capture API requires:
 * POST /v1/payments/:id/capture with { amount, currency }
 * Payment must be in 'authorized' state, otherwise Razorpay returns an error. :contentReference[oaicite:1]{index=1}
 */
router.post("/verify-and-capture", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount, // integer in smallest unit (paise)
      currency = "INR",
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing Razorpay payment fields" });
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount (must be integer in smallest unit)" });
    }

    // 1) Verify signature (prevents fake success calls)
    // signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto.createHmac("sha256", key_secret).update(body).digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Signature verification failed" });
    }

    // 2) (Optional but recommended) Fetch payment to confirm status/amount before capture
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    // You can enforce your own checks:
    // - payment.order_id matches
    // - payment.amount equals your DB amount
    // - payment.status is "authorized" for manual capture
    if (payment.order_id !== razorpay_order_id) {
      return res.status(400).json({ success: false, message: "Order mismatch" });
    }

    // 3) Capture payment
    // Razorpay requires capture amount == authorized amount. :contentReference[oaicite:2]{index=2}
    const captured = await razorpay.payments.capture(razorpay_payment_id, amount, currency);

    return res.json({
      success: true,
      message: "Payment verified & captured",
      payment: captured,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Verify/Capture failed",
      error: err?.error?.description || err?.message || err,
    });
  }
});

/**
 * Fetch payment status (useful for admin/debug)
 */
router.get("/payment/:paymentId", async (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = await razorpay.payments.fetch(paymentId);
    return res.json({ success: true, payment });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Fetch payment failed",
      error: err?.error?.description || err?.message || err,
    });
  }
});

module.exports = router;
