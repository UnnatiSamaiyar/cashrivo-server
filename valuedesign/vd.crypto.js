// server/valuedesign/vd.crypto.js
import crypto from "crypto";

/**
 * Valuedesign uses AES CBC with IV (PDF 3.2). :contentReference[oaicite:0]{index=0}
 * Your credentials:
 *  - key: c5f25d705ac94b789e0d5dd21437612c (32 chars => AES-256)
 *  - iv : 444cb41a7dc94d61 (16 chars)
 *
 * Output: base64 (matches VD "data"/"payload" samples).
 */
function getKeyIv() {
  const keyStr = process.env.VD_SECRET_KEY;
  const ivStr = process.env.VD_SECRET_IV;

  if (!keyStr || !ivStr) throw new Error("VD_SECRET_KEY / VD_SECRET_IV missing in env");

  const key = Buffer.from(keyStr, "utf8");
  const iv = Buffer.from(ivStr, "utf8");

  if (key.length !== 32) throw new Error(`VD_SECRET_KEY must be 32 bytes; got ${key.length}`);
  if (iv.length !== 16) throw new Error(`VD_SECRET_IV must be 16 bytes; got ${iv.length}`);

  return { key, iv };
}

export function encryptJson(obj) {
  const { key, iv } = getKeyIv();
  const plain = JSON.stringify(obj);

  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  // Node crypto uses PKCS7 padding by default (compatible with common AES online tools).
  let enc = cipher.update(plain, "utf8", "base64");
  enc += cipher.final("base64");
  return enc;
}

export function decryptToString(base64Str) {
  const { key, iv } = getKeyIv();

  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let dec = decipher.update(String(base64Str || ""), "base64", "utf8");
  dec += decipher.final("utf8");
  return dec;
}

export function decryptToJson(base64Str) {
  const s = decryptToString(base64Str);
  return JSON.parse(s);
}
