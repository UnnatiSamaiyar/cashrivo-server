// models/VdToken.js
const mongoose = require("mongoose");

/**
 * Caches ValueDesign token in MongoDB.
 * Token validity: 7 days (per VD spec).
 *
 * We store the token encrypted-at-rest (token_enc) and keep metadata for debugging.
 */

const VdTokenSchema = new mongoose.Schema(
  {
    distributor_id: { type: String, index: true, default: "" },

    // token encrypted using utils/secretBox (AES-256-GCM)
    token_enc: { type: String, default: "" },

    // when VD says it expires (YYYY-MM-DD in their token response)
    expiresAt: { type: Date, index: true },

    // raw response from VD token API (masked/partial)
    raw: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

// only one active token per distributor
VdTokenSchema.index({ distributor_id: 1 }, { unique: true });

module.exports = mongoose.model("VdToken", VdTokenSchema);
