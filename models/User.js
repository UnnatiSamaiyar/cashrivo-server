const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  userId: { type: String },
  name: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  referCode: { type: String },

  avatar: { type: String },
  phone: { type: String },
  address: { type: String },
  profileCompletion: {
    isCompleted: { type: Boolean, default: false },
    stepsCompleted: { type: Number, default: 0 }, 
  },
  rivoPoints: { type: Number, default: 0 },
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
