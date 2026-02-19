const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const createToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email || null, userId: user.userId, phone: user.phone || null },
    process.env.JWT_SECRET
  );
};

// small helper: consistent error payload
const sendError = (res, status, code, message) => {
  return res.status(status).json({
    success: false,
    code,
    message,
    msg: message, // ✅ backward compatibility (your frontend/backend already uses msg)
  });
};

const looksLikeEmail = (v) => typeof v === "string" && v.includes("@");
const looksLikeE164 = (v) => typeof v === "string" && /^\+\d{8,15}$/.test(v.trim());

exports.signup = async (req, res) => {
  try {
    const { name, email, phone, password, referCode, phoneVerified } = req.body;

    if (!name || !password) {
      return sendError(res, 400, "VALIDATION_ERROR", "Name and password required");
    }

    // ✅ Determine identifier
    const normalizedEmail = looksLikeEmail(email) ? String(email).trim().toLowerCase() : undefined;

    // Backward-compat: if old clients send phone in `email`, move it to phone
    const normalizedPhone =
      (looksLikeE164(phone) && String(phone).trim()) ||
      (!normalizedEmail && looksLikeE164(email) ? String(email).trim() : undefined);

    if (!normalizedEmail && !normalizedPhone) {
      return sendError(res, 400, "VALIDATION_ERROR", "Email or phone is required");
    }

    // ✅ Uniqueness checks (also protect against old bad data where phone was stored in email)
    if (normalizedEmail) {
      const userExists = await User.findOne({ email: normalizedEmail });
      if (userExists) return sendError(res, 409, "USER_ALREADY_EXISTS", "User already exists");
    }
    if (normalizedPhone) {
      const userExistsPhone = await User.findOne({ $or: [{ phone: normalizedPhone }, { email: normalizedPhone }] });
      if (userExistsPhone) return sendError(res, 409, "USER_ALREADY_EXISTS", "User already exists");
    }

    // ✅ Validate referCode if provided
    if (referCode) {
      const referrer = await User.findOne({ userId: referCode });
      if (!referrer) return sendError(res, 400, "INVALID_REFERRAL", "Invalid referral code");
    }

    const userCount = await User.countDocuments();
    const capitalized = name.trim().toUpperCase();
    const userId = `${capitalized}CR${String(userCount + 1).padStart(4, "0")}`;

    const createPayload = {
      name,
      password,
      userId,
      referCode,
      email: normalizedEmail || undefined,
      phone: normalizedPhone || undefined,
      phoneVerified: Boolean(normalizedPhone) ? Boolean(phoneVerified) : false,
      phoneVerifiedAt: Boolean(normalizedPhone) && Boolean(phoneVerified) ? new Date() : null,
    };

    const user = await User.create(createPayload);

    const token = createToken(user);
    const { password: pwd, ...safeUser } = user._doc;

    return res.status(201).json({
      success: true,
      token,
      user: safeUser,
      message: "Signup successful",
    });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "SERVER_ERROR", err.message || "Server error");
  }
};

exports.login = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    // ✅ Legacy contract: identifier usually comes in "email"
    const identifier = (phone || email || "").toString().trim();

    if (!identifier || !password) {
      return sendError(res, 400, "VALIDATION_ERROR", "Email/phone and password required");
    }

    let user = null;

    if (looksLikeEmail(identifier)) {
      user = await User.findOne({ email: identifier.toLowerCase() });
    } else {
      // phone login (E.164)
      if (!looksLikeE164(identifier)) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid phone number");
      }
      user = await User.findOne({ $or: [{ phone: identifier }, { email: identifier }] });
      if (user && user.phoneVerified === false) {
        return sendError(res, 403, "PHONE_NOT_VERIFIED", "Please verify phone");
      }
    }

    if (!user) {
      return sendError(res, 404, "USER_NOT_FOUND", "Account doesn't exist");
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return sendError(res, 401, "INVALID_PASSWORD", "Incorrect password");
    }

    const token = createToken(user);
    const { password: pwd, ...safeUser } = user._doc;

    return res.status(200).json({
      success: true,
      token,
      user: safeUser,
      message: "Login successful",
    });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "SERVER_ERROR", err.message || "Server error");
  }
};

// UPDATE USER BY userId
exports.updateUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const updated = await User.findOneAndUpdate({ userId }, req.body, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!updated) {
      return sendError(res, 404, "USER_NOT_FOUND", "User not found");
    }

    return res.status(200).json({
      success: true,
      user: updated,
      message: "User updated successfully",
    });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "SERVER_ERROR", "Server error during update");
  }
};

// OPTIONAL: GET ALL USERS
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    return res.status(200).json({
      success: true,
      users,
      message: "Users fetched successfully",
    });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "SERVER_ERROR", "Server error");
  }
};

exports.forgot = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendError(res, 400, "VALIDATION_ERROR", "Email is required");
    }

    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) {
      return sendError(res, 404, "USER_NOT_FOUND", "User not found");
    }

    return res.json({
      success: true,
      message: "Reset link would be sent to email in production.",
      msg: "Reset link would be sent to email in production.",
    });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "SERVER_ERROR", err.message || "Server error");
  }
};

// ✅ NEW: Phone password reset (no OTP here; backend enforces phoneVerified=true)
exports.resetPasswordPhone = async (req, res) => {
  try {
    const { phone, newPassword } = req.body;

    if (!looksLikeE164(phone) || !newPassword) {
      return sendError(res, 400, "VALIDATION_ERROR", "Phone and new password are required");
    }
    if (String(newPassword).length < 6) {
      return sendError(res, 400, "VALIDATION_ERROR", "Password must be at least 6 characters");
    }

    const user = await User.findOne({ phone: String(phone).trim() });
    if (!user) return sendError(res, 404, "USER_NOT_FOUND", "User not found");
    if (!user.phoneVerified) return sendError(res, 403, "PHONE_NOT_VERIFIED", "Please verify phone");

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(String(newPassword), salt);

    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({ success: true, message: "Password reset successful." });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "SERVER_ERROR", err.message || "Server error");
  }
};

// ✅ NEW: One-time migration — move phone-like emails into phone field
exports.migratePhoneFromEmail = async (req, res) => {
  try {
    const now = new Date();
    const cursor = User.find({ email: { $regex: /^\+\d{8,15}$/ } }).cursor();

    let updatedCount = 0;
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      const phoneVal = String(doc.email).trim();
      if (!looksLikeE164(phoneVal)) continue;

      // Skip if phone already exists (avoid collisions)
      const collision = await User.findOne({ phone: phoneVal, _id: { $ne: doc._id } });
      if (collision) continue;

      doc.phone = phoneVal;
      doc.email = undefined;
      doc.phoneVerified = true;
      doc.phoneVerifiedAt = now;
      await doc.save();
      updatedCount += 1;
    }

    return res.status(200).json({ success: true, updatedCount });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "SERVER_ERROR", err.message || "Server error");
  }
};
