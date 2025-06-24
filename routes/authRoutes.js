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
const nodemailer = require("nodemailer");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

// Configure your transporter (example with Gmail)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});
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

    // 2. Generate OTP and expiry (say 10 mins)
    const otp = generateOtp();
    const IST_OFFSET = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000 + IST_OFFSET);

    // 3. Save OTP to DB (remove old OTP for this email if exists)
    await Otp.findOneAndDelete({ email });
    await new Otp({ email, otp, expiresAt }).save();

    // 4. Send OTP email
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP code is ${otp}. It expires in 10 minutes.`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("Error sending OTP:", err);
    res.status(500).json({ message: "Internal Server Error" });
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
    res.status(200).json({ message: "OTP verified successfully" });

  } catch (error) {
    console.error("OTP verification failed:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ message: "Email, OTP, and new password are required." });
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
