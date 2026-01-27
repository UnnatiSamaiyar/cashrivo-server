const User = require("../models/User");
const jwt = require("jsonwebtoken");

const createToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, userId: user.userId },
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

exports.signup = async (req, res) => {
  try {
    const { name, email, password, referCode } = req.body;

    if (!name || !email || !password) {
      return sendError(res, 400, "VALIDATION_ERROR", "All fields required");
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      // ✅ account exists
      return sendError(res, 409, "USER_ALREADY_EXISTS", "User already exists");
    }

    // ✅ Validate referCode if provided
    if (referCode) {
      const referrer = await User.findOne({ userId: referCode });
      if (!referrer) {
        return sendError(res, 400, "INVALID_REFERRAL", "Invalid referral code");
      }
    }

    const userCount = await User.countDocuments();
    const capitalized = name.trim().toUpperCase();
    const userId = `${capitalized}CR${String(userCount + 1).padStart(4, "0")}`;

    const user = await User.create({
      name,
      email,
      password,
      userId,
      referCode,
    });

    const token = createToken(user);

    return res.status(201).json({
      success: true,
      token,
      user,
      message: "Signup successful",
    });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "SERVER_ERROR", err.message || "Server error");
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 400, "VALIDATION_ERROR", "Email and password required");
    }

    const user = await User.findOne({ email });
    if (!user) {
      // ✅ account doesn't exist
      return sendError(res, 404, "USER_NOT_FOUND", "Account doesn't exist");
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // ✅ incorrect password
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

    const user = await User.findOne({ email });
    if (!user) {
      return sendError(res, 404, "USER_NOT_FOUND", "User not found");
    }

    return res.json({
      success: true,
      message: "Reset link would be sent to email in production.",
      msg: "Reset link would be sent to email in production.", // backward
    });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "SERVER_ERROR", err.message || "Server error");
  }
};
