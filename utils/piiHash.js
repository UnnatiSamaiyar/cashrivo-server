const crypto = require("crypto");

function stableSalt() {
  // For production, set PII_HASH_SALT.
  // Fallback keeps backward-compatibility in test/staging.
  return String(process.env.PII_HASH_SALT || process.env.JWT_SECRET || "cashrivo").trim();
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input || "")).digest("hex");
}

exports.hashPhone = function hashPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "").slice(-10);
  return sha256Hex(`${stableSalt()}|phone|${digits}`);
};

exports.normalizeVpa = function normalizeVpa(vpa) {
  return String(vpa || "").trim().toLowerCase();
};

exports.hashVpa = function hashVpa(vpa) {
  const n = exports.normalizeVpa(vpa);
  return sha256Hex(`${stableSalt()}|vpa|${n}`);
};
