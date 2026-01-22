// utils/vdCrypto.js
const crypto = require("crypto");

/**
 * Valuedesign Decrypt
 * Mode: AES-256-CBC
 * Input: Base64
 *
 * NOTE: Provided key/iv lengths in real-world integrations are sometimes "passphrase-like".
 * This utility supports:
 * - key as hex 64 chars => 32 bytes (true 256-bit key)
 * - key as hex 32 chars => 16 bytes => expanded to 32 bytes via SHA-256
 * - key as utf8 => hashed to 32 bytes via SHA-256
 *
 * - iv as hex 32 chars => 16 bytes
 * - iv as hex 16 chars => 8 bytes => expanded to 16 bytes via MD5
 * - iv as utf8 => MD5 => 16 bytes
 */

function isHex(str) {
  return typeof str === "string" && /^[0-9a-fA-F]+$/.test(str);
}

function normalizeKey(secretKey) {
  if (!secretKey) throw new Error("VD secret key missing");

  const k = String(secretKey).trim();

  // Hex key
  if (isHex(k)) {
    if (k.length === 64) return Buffer.from(k, "hex"); // 32 bytes
    if (k.length === 32) {
      // 16 bytes -> expand to 32 bytes deterministically
      const raw = Buffer.from(k, "hex");
      return crypto.createHash("sha256").update(raw).digest();
    }
    // other hex length -> hash to 32 bytes
    return crypto.createHash("sha256").update(Buffer.from(k, "hex")).digest();
  }

  // UTF8 passphrase
  return crypto.createHash("sha256").update(k, "utf8").digest(); // 32 bytes
}

function normalizeIv(secretIv) {
  if (!secretIv) throw new Error("VD secret iv missing");

  const v = String(secretIv).trim();

  if (isHex(v)) {
    if (v.length === 32) return Buffer.from(v, "hex"); // 16 bytes
    if (v.length === 16) {
      // 8 bytes -> expand to 16 bytes using MD5
      return crypto.createHash("md5").update(Buffer.from(v, "hex")).digest(); // 16 bytes
    }
    return crypto.createHash("md5").update(Buffer.from(v, "hex")).digest();
  }

  // UTF8 -> MD5 (16 bytes)
  return crypto.createHash("md5").update(v, "utf8").digest();
}

function vdDecryptBase64(cipherTextBase64, secretKey, secretIv) {
  if (!cipherTextBase64) return null;

  const key = normalizeKey(secretKey);
  const iv = normalizeIv(secretIv);

  const encrypted = Buffer.from(String(cipherTextBase64).trim(), "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  decipher.setAutoPadding(true);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

function safeJsonParse(s) {
  if (!s || typeof s !== "string") return null;
  const t = s.trim();
  try {
    return JSON.parse(t);
  } catch {
    // sometimes response is JSON-like but not valid; return string
    return null;
  }
}

module.exports = {
  vdDecryptBase64,
  safeJsonParse,
};
