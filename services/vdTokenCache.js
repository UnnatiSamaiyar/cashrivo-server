// services/vdTokenCache.js
"use strict";

const { assertUrl, vdPost } = require("./vdClient");
const { vdDecryptBase64, safeJsonParse } = require("../utils/vdCrypto");
const { encryptJson, decryptJson } = require("../utils/secretBox");
const VdToken = require("../models/VdToken");
const VdApiLog = require("../models/VdApiLog");

/**
 * ValueDesign token rules (per spec): token valid for 7 days.
 * We cache it in MongoDB so:
 * - server restarts don't break purchase flows
 * - multiple instances share the same token
 */

function vdUrls() {
  const VD_BASE = (process.env.VD_BASE || "").replace(/\/+$/, "");
  return {
    TOKEN: process.env.VD_TOKEN_URL || (VD_BASE ? `${VD_BASE}/api-generatetoken/` : ""),
  };
}

function _getSecrets() {
  const key = (process.env.VD_SECRET_KEY || "").trim();
  const iv = (process.env.VD_SECRET_IV || "").trim();
  if (!key || !iv) throw new Error("VD_SECRET_KEY / VD_SECRET_IV missing in env");
  return { key, iv };
}

function _parseExpiryDate(expiry) {
  // VD returns: "YYYY-MM-DD" (see your log)
  const s = String(expiry || "").trim();
  if (!s) return null;
  const d = new Date(`${s}T23:59:59.999Z`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function _cleanTokenString(s) {
  return String(s || "")
    .replace(/[\r\n\t\"]+/g, "")
    .replace(/[{}]/g, "")
    .trim();
}

async function _logTokenCall({ reqHeaders, reqBody, url, responseRaw, tokenUsed, encrypted, decryptedText, decryptedJson }) {
  try {
    await VdApiLog.create({
      type: "TOKEN",
      request: {
        headers: {
          ...reqHeaders,
          password: reqHeaders?.password ? "***" : reqHeaders?.password,
        },
        body: reqBody || {},
        url,
        method: "POST",
        token: tokenUsed || "",
      },
      responseRaw: responseRaw || {},
      encrypted: encrypted || "",
      decryptedText: decryptedText || "",
      decryptedJson: decryptedJson || null,
      distributor_id: reqBody?.distributor_id || "",
    });
  } catch {
    // never block runtime on logs
  }
}

/**
 * Get a valid VD token from DB.
 * - If present and not expired -> return.
 * - Else generate new token and cache.
 */
async function getVdToken({ force = false } = {}) {
  const distributor_id = (process.env.VD_DISTRIBUTOR_ID || "").trim();
  if (!distributor_id) throw new Error("VD_DISTRIBUTOR_ID missing in env");

  if (!force) {
    const cached = await VdToken.findOne({ distributor_id }).lean();
    if (cached?.token_enc && cached?.expiresAt) {
      // Consider token valid until end-of-day UTC of expiry_date.
      const now = new Date();
      if (new Date(cached.expiresAt).getTime() > now.getTime()) {
        const t = decryptJson(cached.token_enc);
        if (t) return String(t);
      }
    }
  }

  const { TOKEN } = vdUrls();
  assertUrl(TOKEN, "VD_TOKEN_URL");

  const username = (process.env.VD_USERNAME || "").trim();
  const password = (process.env.VD_PASSWORD || "").trim();
  if (!username || !password) throw new Error("VD_USERNAME / VD_PASSWORD missing in env");

  // SPEC (PDF):
  // - POST
  // - headers: username, password
  // - body: { distributor_id }
  const reqHeaders = { username, password };
  const reqBody = { distributor_id };

  const responseRaw = await vdPost(TOKEN, reqBody, reqHeaders, 20000);

  // Real world response seen in your DB log:
  // { responseCode:200, status:"SUCCESS", token:"<base64>", expiry_date:"YYYY-MM-DD" }
  const encToken = responseRaw?.token || responseRaw?.Token || responseRaw?.data || "";
  const expiry_date = responseRaw?.expiry_date || responseRaw?.expiryDate || "";
  const expiresAt = _parseExpiryDate(expiry_date) || new Date(Date.now() + 6 * 24 * 3600 * 1000);

  const { key, iv } = _getSecrets();
  let decryptedText = "";
  let decryptedJson = null;
  let tokenFinal = "";

  if (encToken && typeof encToken === "string") {
    const dec = vdDecryptBase64(encToken, key, iv);
    if (dec) {
      decryptedText = dec;
      decryptedJson = safeJsonParse(dec);
      // Token decrypt in doc can be a raw token string wrapped in braces/newlines.
      tokenFinal = _cleanTokenString(decryptedJson?.token || decryptedJson?.Token || dec);
    } else {
      // If decrypt fails, keep raw (some VD deployments send plain token)
      tokenFinal = _cleanTokenString(encToken);
    }
  }

  if (!tokenFinal) {
    await _logTokenCall({ reqHeaders, reqBody, url: TOKEN, responseRaw, tokenUsed: "", encrypted: encToken, decryptedText, decryptedJson });
    throw new Error("VD token not found / decrypt failed");
  }

  // upsert cache
  await VdToken.findOneAndUpdate(
    { distributor_id },
    {
      $set: {
        distributor_id,
        token_enc: encryptJson(tokenFinal),
        expiresAt,
        raw: {
          responseCode: responseRaw?.responseCode,
          responseMsg: responseRaw?.responseMsg,
          status: responseRaw?.status,
          expiry_date: expiry_date || null,
          token_preview: tokenFinal ? `${tokenFinal.slice(0, 6)}***${tokenFinal.slice(-4)}` : "",
        },
      },
    },
    { upsert: true, new: true }
  );

  await _logTokenCall({ reqHeaders, reqBody, url: TOKEN, responseRaw, tokenUsed: tokenFinal, encrypted: encToken, decryptedText, decryptedJson });

  return tokenFinal;
}

module.exports = { getVdToken };
