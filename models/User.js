const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    userId: { type: String },
    name: { type: String },

    // ✅ Email is optional (unique when present)
    email: { type: String, unique: true, sparse: true, default: undefined },

    // ✅ Phone is optional (E.164), unique when present
    phone: { type: String, unique: true, sparse: true, default: undefined },

    // Brand compliance / verification
    phoneVerified: { type: Boolean, default: false },
    phoneVerifiedAt: { type: Date, default: null },

    password: { type: String, required: true },
    referCode: { type: String },

    avatar: { type: String },
    address: { type: String },

    profileCompletion: {
      isCompleted: { type: Boolean, default: false },
      stepsCompleted: { type: Number, default: 0 },
    },
    rivoPoints: { type: Number, default: 10 },
  },
  { timestamps: true }
);

// ✅ Require at least one contact identifier (email or phone)
userSchema.pre("validate", function (next) {
  if (!this.email && !this.phone) {
    return next(new Error("Either email or phone is required"));
  }
  return next();
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  // If already hashed (starts with $2), skip rehashing
  if (typeof this.password === "string" && this.password.startsWith("$2")) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
