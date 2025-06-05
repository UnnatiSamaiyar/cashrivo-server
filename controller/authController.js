const User = require("../models/User");
const jwt = require("jsonwebtoken");

const createToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, userId: user.userId },
    process.env.JWT_SECRET
  );
};

exports.signup = async (req, res) => {
  try {
    const { name, email, password, referCode } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ msg: "All fields required" });

    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ msg: "User already exists" });

    // ✅ Validate referCode if provided
    if (referCode) {
      const referrer = await User.findOne({ userId: referCode });
      if (!referrer) {
        return res.status(400).json({ msg: "Invalid referral code" });
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
    res.status(201).json({ token, user });
    console.log(user.userId);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "Invalid credentials" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    const token = createToken(user);
    const { password: pwd, ...safeUser } = user._doc;
    res.status(200).json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};


// UPDATE USER BY userId
exports.updateUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const updated = await User.findOneAndUpdate(
      { userId }, // Find by userId instead of _id
      req.body,
      {
        new: true,
        runValidators: true,
      }
    ).select("-password"); // Exclude password from response

    if (!updated) return res.status(404).json({ msg: "User not found" });

    res.status(200).json({ user: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error during update" });
  }
};

// OPTIONAL: GET ALL USERS
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.forgot = async (req, res) => {
  try {
    const { email } = req.body;
    // Placeholder logic — in production, you'd send a reset email
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: "User not found" });

    res.json({ msg: "Reset link would be sent to email in production." });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};


