// server/models/VdToken.js
const mongoose = require("mongoose");

/**
 * Caches ValueDesign token in MongoDB.
 * Token validity: 7 days (per VD spec).
 *
 * We keep token encrypted-at-rest (token_enc).
 * If you REALLY want decrypted token stored, set:
 *   VD_STORE_TOKEN_PLAIN=true
 * then system will also store token_plain (NOT recommended).
 */
const VdTokenSchema = new mongoose.Schema(
  {
    distributor_id: { type: String, index: true, default: "" },

    // token encrypted using utils/secretBox (AES-256-GCM)
    token_enc: { type: String, default: "" },

    // OPTIONAL (only when VD_STORE_TOKEN_PLAIN=true)
    token_plain: { type: String, default: "" },

    // when VD says it expires
    expiresAt: { type: Date, index: true },

    // raw response from VD token API (masked/partial)
    raw: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

// only one active token per distributor
VdTokenSchema.index({ distributor_id: 1 }, { unique: true });

module.exports = mongoose.model("VdToken", VdTokenSchema);
