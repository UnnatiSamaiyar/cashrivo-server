// server/valuedesign/vd.crypto.js
const crypto = require("crypto");

function getKeyIv() {
  const keyStr = process.env.VD_SECRET_KEY;
  const ivStr = process.env.VD_SECRET_IV;

  if (!keyStr || !ivStr) throw new Error("VD_SECRET_KEY / VD_SECRET_IV missing");

  const key = Buffer.from(keyStr, "utf8");
  const iv = Buffer.from(ivStr, "utf8");

  if (key.length !== 32) throw new Error(`VD_SECRET_KEY must be 32 bytes; got ${key.length}`);
  if (iv.length !== 16) throw new Error(`VD_SECRET_IV must be 16 bytes; got ${iv.length}`);

  return { key, iv };
}

exports.encryptJson = (obj) => {
  const { key, iv } = getKeyIv();
  const plain = JSON.stringify(obj);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let enc = cipher.update(plain, "utf8", "base64");
  enc += cipher.final("base64");
  return enc;
};

exports.decryptToString = (base64Str) => {
  const { key, iv } = getKeyIv();
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let dec = decipher.update(String(base64Str || ""), "base64", "utf8");
  dec += decipher.final("utf8");
  return dec;
};

exports.decryptToJson = (base64Str) => JSON.parse(exports.decryptToString(base64Str));
