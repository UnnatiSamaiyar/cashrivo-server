// scripts/seedAdmin.js
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const exists = await User.findOne({ email: "admin@cashrivo.com" });
  if (exists) {
    console.log("Admin already exists");
    process.exit(0);
  }
  const admin = new User({
    user_role: "admin",
    email: "admin@cashrivo.com",
    password: "StrongAdminPassword123!", // CHANGE immediately after first login
    websites_access: []
  });
  await admin.save();
  console.log("Admin created");
  process.exit(0);
});
