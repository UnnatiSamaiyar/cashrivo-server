// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const WebsiteAccessSchema = new mongoose.Schema({
  site: { type: mongoose.Schema.Types.ObjectId, ref: "Website", required: true },
  features_access: [{ type: String }] // e.g. ['users','deals','blogs','analytics']
}, { _id: false });

const UserSchema = new mongoose.Schema({
  user_role: { type: String, enum: ["admin","sub-admin"], required: true },
  email: { type: String, required: true, unique: true, lowercase:true, trim:true },
  password: { type: String, required: true }, // hashed
  websites_access: { type: [WebsiteAccessSchema], default: [] }
}, { timestamps: true });

UserSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = function(plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model("User", UserSchema);
