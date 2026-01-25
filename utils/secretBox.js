const crypto = require("crypto");

/**
 * AES-256-GCM helper for encrypting sensitive fields at rest.
 *
 * ENV priority:
 *  - GIFT_SECRET_KEY (recommended)
 *  - JWT_SECRET (fallback)
 */
function getKey() {
  const raw = (process.env.GIFT_SECRET_KEY || process.env.JWT_SECRET || "").toString();
  if (!raw) throw new Error("Missing GIFT_SECRET_KEY (or JWT_SECRET) for encryption");
  // Derive fixed-length 32-byte key
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

exports.encryptJson = function encryptJson(obj) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(obj || null), "utf8");
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  // base64(iv).base64(tag).base64(ciphertext)
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
};

exports.decryptJson = function decryptJson(payload) {
  if (!payload || typeof payload !== "string") return null;
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) return null;

  const key = getKey();
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  try {
    return JSON.parse(dec);
  } catch {
    return null;
  }
};
