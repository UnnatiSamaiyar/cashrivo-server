
"use strict";
const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const PhoneOtpSession = require("../models/PhoneOtpSession");
const { sendOtp } = require("../services/swipeSms");

function hash(v) {
  return crypto.createHash("sha256").update(String(v)).digest("hex");
}
function genOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

router.post("/phone/request-otp", async (req, res) => {
  try {
    const phone = String(req.body.phone || req.body.mobile || "").replace(/\D/g, "");
    if (phone.length < 10) return res.status(400).json({ success: false, message: "Invalid phone" });

    const otp = genOtp();
    await PhoneOtpSession.deleteMany({ phone });
    await PhoneOtpSession.create({
      phone,
      otpHash: hash(otp),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    await sendOtp({ phone, message: `Your Cashrivo OTP is ${otp}. Valid for 5 minutes.` });
    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "OTP send failed" });
  }
});

router.post("/phone/verify-otp", async (req, res) => {
  try {
    const phone = String(req.body.phone || req.body.mobile || "").replace(/\D/g, "");
    const otp = String(req.body.otp || "");
    const sess = await PhoneOtpSession.findOne({ phone });
    if (!sess || sess.expiresAt < new Date()) return res.status(400).json({ success: false, message: "OTP expired" });
    if (hash(otp) !== sess.otpHash) return res.status(400).json({ success: false, message: "Invalid OTP" });
    await PhoneOtpSession.deleteMany({ phone });
    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false });
  }
});

module.exports = router;
