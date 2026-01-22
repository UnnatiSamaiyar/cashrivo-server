// models/VdEvcOrder.js
const mongoose = require("mongoose");

const VdEvcOrderSchema = new mongoose.Schema(
  {
    order_id: { type: String, index: true },
    request_ref_no: { type: String, index: true },

    responseCode: { type: String, default: "" },
    responseMsg: { type: String, default: "" },
    status: { type: String, default: "" },

    // encrypted data returned by VD and our decrypted JSON
    encryptedData: { type: String, default: "" },
    decryptedText: { type: String, default: "" },
    decryptedJson: { type: Object, default: null },

    // last status check payload
    lastStatusRaw: { type: Object, default: null },
    lastActivatedRaw: { type: Object, default: null },

    // store request payload you sent to VD (the encrypted "payload" you forwarded)
    requestPayloadEncrypted: { type: String, default: "" },

    tokenUsed: { type: String, default: "" },
  },
  { timestamps: true }
);

VdEvcOrderSchema.index({ order_id: 1, request_ref_no: 1 });

module.exports = mongoose.model("VdEvcOrder", VdEvcOrderSchema);
