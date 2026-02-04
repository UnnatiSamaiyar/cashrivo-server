// routes/auth.js
"use strict";

const express = require("express");
const router = express.Router();

const {
  signup,
  login,
  forgot,
  getUsers,
  updateUser,
} = require("../controller/authController");

const Otp = require("../models/Otp");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

// ✅ Use centralized mailer (SMTP/Gmail fallback)
const { sendMail } = require("../services/mailer");

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}

router.post("/signup", signup);
router.post("/login", login);
router.post("/forgot", forgot);
router.get("/users", getUsers);
router.put("/users/:userId", updateUser);

router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    // 1. Check if email exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Email does not exist" });
    }

    // 2. Generate OTP and expiry (10 mins)
    const otp = generateOtp();

    // ✅ Correct expiry: 10 minutes from now (no manual IST offset needed)
    // (Date objects are timezone-agnostic; adding IST offset makes expiry ~5.5h longer)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // 3. Save OTP to DB (remove old OTP for this email if exists)
    await Otp.findOneAndDelete({ email });
    await new Otp({ email, otp, expiresAt }).save();

    // 4. Send OTP email (via SMTP)
    await sendMail({
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP code is ${otp}. It expires in 10 minutes.`,
      // html: `<p>Your OTP code is <b>${otp}</b>. It expires in 10 minutes.</p>`,
    });

    return res.status(200).json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("Error sending OTP:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }

  try {
    const otpEntry = await Otp.findOne({ email, otp });

    if (!otpEntry) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (new Date() > otpEntry.expiresAt) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    // ✅ OTP is valid — no deletion yet
    return res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error("OTP verification failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res
      .status(400)
      .json({ message: "Email, OTP, and new password are required." });
  }

  try {
    // 1. Validate OTP
    const otpEntry = await Otp.findOne({ email, otp });
    if (!otpEntry) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    if (new Date() > otpEntry.expiresAt) {
      await Otp.deleteOne({ _id: otpEntry._id });
      return res.status(400).json({ message: "OTP has expired." });
    }

    // 2. Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // 3. Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 4. Update password
    user.password = hashedPassword;
    await user.save();

    // 5. Cleanup used OTP
    await Otp.deleteOne({ _id: otpEntry._id });

    return res.status(200).json({ message: "Password reset successful." });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Server error." });
  }
});

module.exports = router;
