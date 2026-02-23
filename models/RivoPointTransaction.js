const mongoose = require("mongoose");

const RivoPointTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // CREDIT adds points, DEBIT consumes points (future-safe)
    direction: { type: String, enum: ["CREDIT", "DEBIT"], default: "CREDIT", index: true },

    // points applied in this transaction (always positive number)
    points: { type: Number, required: true, min: 1 },

    // snapshot metadata
    percent: { type: Number, default: null },
    amount: { type: Number, default: null },
    balanceAfter: { type: Number, default: null },

    // idempotency / source mapping
    sourceType: { type: String, required: true, index: true },
    sourceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

    note: { type: String, default: "" },
  },
  { timestamps: true }
);

// ✅ Ensure we don't award points twice for the same source
RivoPointTransactionSchema.index(
  { user: 1, sourceType: 1, sourceId: 1 },
  { unique: true }
);

module.exports = mongoose.model("RivoPointTransaction", RivoPointTransactionSchema);
