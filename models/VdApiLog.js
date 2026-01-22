// models/VdApiLog.js
const mongoose = require("mongoose");

const VdApiLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["TOKEN", "BRANDS", "STORES", "EVC", "EVC_STATUS", "EVC_ACTIVATED", "WALLET"],
      required: true,
      index: true,
    },

    // request metadata
    request: {
      headers: { type: Object, default: {} },
      body: { type: Object, default: {} },
      url: { type: String, default: "" },
      method: { type: String, default: "POST" },
      token: { type: String, default: "" }, // VD token used
    },

    // raw response from VD
    responseRaw: { type: Object, default: {} },

    // encrypted string (if any)
    encrypted: { type: String, default: "" },

    // decrypted string (if any)
    decryptedText: { type: String, default: "" },

    // parsed JSON (if possible)
    decryptedJson: { type: Object, default: null },

    // helpful refs for querying
    order_id: { type: String, default: "", index: true },
    request_ref_no: { type: String, default: "", index: true },
    brandCode: { type: String, default: "", index: true },
    distributor_id: { type: String, default: "", index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("VdApiLog", VdApiLogSchema);
