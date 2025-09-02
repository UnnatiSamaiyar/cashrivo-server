const mongoose = require("mongoose");

const cuelinkSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: String,
  url: String,
  domain: String,
  payout_type: String,
  payout: Number,
  image: String,
  last_modified: Date,
});

module.exports = mongoose.model("Cuelink", cuelinkSchema);
