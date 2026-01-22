// models/VdWallet.js
const mongoose = require("mongoose");

const VdWalletSchema = new mongoose.Schema(
  {
    distributor_id: { type: String, index: true },
    tokenUsed: { type: String, default: "" },

    responseCode: { type: String, default: "" },
    responseMsg: { type: String, default: "" },

    encryptedData: { type: String, default: "" },
    decryptedText: { type: String, default: "" },
    decryptedJson: { type: Object, default: null },

    raw: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("VdWallet", VdWalletSchema);
