const crypto = require("crypto");

function bufUtf8(s) {
  return Buffer.from(String(s || ""), "utf8");
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
 * Vendor expects AES-256-CBC base64.
 * We mirror the decryption approach: treat key/iv as UTF-8 and pad/repeat.
 */
exports.vdEncryptBase64 = function vdEncryptBase64(plainText, secretKey, secretIv) {
  const key = repeatToLen(bufUtf8(secretKey), 32);
  const iv = repeatToLen(bufUtf8(secretIv), 16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  cipher.setAutoPadding(true);
  const enc = Buffer.concat([cipher.update(Buffer.from(String(plainText || ""), "utf8")), cipher.final()]);
  return enc.toString("base64");
};
