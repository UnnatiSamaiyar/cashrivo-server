// server/models/VdJobState.js
const mongoose = require("mongoose");

/**
 * Small state doc to track last automation runs.
 */
const VdJobStateSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, index: true }, // "token" | "brands"
    lastRunAt: { type: Date, default: null },
    lastOkAt: { type: Date, default: null },
    lastStatus: { type: String, default: "" }, // OK / ERROR
    lastError: { type: String, default: "" },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("VdJobState", VdJobStateSchema);
