// utils/vdCrypto.js
const crypto = require("crypto");

/**
 * Valuedesign Decrypt
 * Mode: AES-256-CBC
 * Input: Base64 / Base64URL
 *
 * Vendor ambiguity hoti hai (key/iv ko hex treat kare ya utf8).
 * Isliye hum multi-strategy try karte hain and pehli successful decrypt return karte hain.
 * Agar decrypt fail ho -> null return (API crash nahi karegi).
 */

function isHex(str) {
  return typeof str === "string" && /^[0-9a-fA-F]+$/.test(str);
}

function bufUtf8(s) {
  return Buffer.from(String(s || ""), "utf8");
}

function bufHex(s) {
  return Buffer.from(String(s || ""), "hex");
}

function repeatToLen(buf, len) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf || "");
  if (buf.length === 0) return Buffer.alloc(len, 0);
  if (buf.length === len) return buf;
  const out = Buffer.alloc(len);
  for (let i = 0; i < len; i++) out[i] = buf[i % buf.length];
  return out;
}

/**
 * Normalize base64 / base64url:
 * - converts '-' -> '+', '_' -> '/'
 * - removes whitespace/newlines
 * - pads '=' to multiple of 4
 */
function normalizeBase64(input) {
  if (!input || typeof input !== "string") return "";
  let s = input.trim();

  // base64url -> base64
  s = s.replace(/-/g, "+").replace(/_/g, "/");

  // remove whitespace/newlines
  s = s.replace(/\s+/g, "");

  // pad
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);

  return s;
}

/**
 * Return list of candidate (key, iv) buffers to try
 */
function candidateKeyIv(secretKey, secretIv) {
  const k = String(secretKey || "").trim();
  const v = String(secretIv || "").trim();

  const candidates = [];

  // Strategy A (MOST COMMON for vendors):
  // Treat key as UTF8 (must be 32 bytes) and iv as UTF8 (16 bytes)
  candidates.push({
    name: "utf8-key-utf8-iv",
    key: repeatToLen(bufUtf8(k), 32),
    iv: repeatToLen(bufUtf8(v), 16),
  });

  // Strategy B: key hex -> raw bytes (if hex), then repeat/pad to 32; iv utf8
  if (isHex(k)) {
    candidates.push({
      name: "hex-key-utf8-iv",
      key: repeatToLen(bufHex(k), 32),
      iv: repeatToLen(bufUtf8(v), 16),
    });
  }

  // Strategy C: key utf8 hashed sha256; iv utf8 md5
  candidates.push({
    name: "sha256-utf8-key-md5-utf8-iv",
    key: crypto.createHash("sha256").update(k, "utf8").digest(),
    iv: crypto.createHash("md5").update(v, "utf8").digest(),
  });

  // Strategy D: if iv is hex, use hex bytes repeated to 16
  if (isHex(v)) {
    candidates.push({
      name: "utf8-key-hex-iv",
      key: repeatToLen(bufUtf8(k), 32),
      iv: repeatToLen(bufHex(v), 16),
    });
  }

  // Strategy E: both hex raw bytes repeated
  if (isHex(k) && isHex(v)) {
    candidates.push({
      name: "hex-key-hex-iv",
      key: repeatToLen(bufHex(k), 32),
      iv: repeatToLen(bufHex(v), 16),
    });
  }

  return candidates;
}

function vdDecryptBase64(cipherTextBase64, secretKey, secretIv) {
  if (!cipherTextBase64) return null;

  const normalized = normalizeBase64(String(cipherTextBase64));
  if (!normalized) return null;

  const encrypted = Buffer.from(normalized, "base64");
  const attempts = candidateKeyIv(secretKey, secretIv);

  for (const a of attempts) {
    try {
      const decipher = crypto.createDecipheriv("aes-256-cbc", a.key, a.iv);
      decipher.setAutoPadding(true);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      const text = decrypted.toString("utf8");

      // basic sanity: decrypted empty/garbage ho to continue
      if (text && text.trim().length) return text;
    } catch {
      // try next strategy
    }
  }

  // final: fail -> return null (do not crash API)
  return null;
}

function safeJsonParse(s) {
  if (!s || typeof s !== "string") return null;
  const t = s.trim();
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

module.exports = {
  vdDecryptBase64,
  safeJsonParse,
};
