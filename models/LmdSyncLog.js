const mongoose = require("mongoose");

const LmdSyncLogSchema = new mongoose.Schema(
  {
    totalFetched: { type: Number, required: true },
    inserted: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now },
    status: { type: String, enum: ["success", "failed"], default: "success" },
    message: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LmdSyncLog", LmdSyncLogSchema);
