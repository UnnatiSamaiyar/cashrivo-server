// server/services/vdAutomation.js
"use strict";

/**
 * Production-safe automation (no breaking changes):
 * - Refresh token before expiry (checks every 6 hours)
 * - Sync brands once per day
 *
 * Scheduler is OFF only when VD_AUTOMATION_ENABLED=false
 *
 * How to start:
 *   const { initVdAutomation } = require("./services/vdAutomation");
 *   initVdAutomation(); // after DB connection
 */

const { assertUrl, vdPost } = require("./vdClient"); // existing service in your codebase
const { getVdToken } = require("./vdTokenCache");    // existing service in your codebase
const { vdDecryptBase64, safeJsonParse } = require("../utils/vdCrypto");

const VdBrand = require("../models/VdBrand");
const VdApiLog = require("../models/VdApiLog");
const VdToken = require("../models/VdToken");
const VdJobState = require("../models/VdJobState");

const VD_BASE = (process.env.VD_BASE || "").replace(/\/+$/, "");
const URLS = {
  TOKEN: process.env.VD_TOKEN_URL || (VD_BASE ? `${VD_BASE}/api-generatetoken/` : ""),
  BRANDS: process.env.VD_BRAND_URL || (VD_BASE ? `${VD_BASE}/api-getbrand/` : ""),
};

const VD_SECRET_KEY = (process.env.VD_SECRET_KEY || "").trim();
const VD_SECRET_IV = (process.env.VD_SECRET_IV || "").trim();

function enabled() {
  return String(process.env.VD_AUTOMATION_ENABLED || "").toLowerCase() !== "false";
}

function safeHeadersForLog(headers) {
  const h = headers || {};
  const clone = { ...h };
  if (clone.password) clone.password = "***";
  if (clone.Password) clone.Password = "***";
  if (clone["x-password"]) clone["x-password"] = "***";
  return clone;
}

async function logApi({ type, url, token, requestBody, responseRaw, encrypted, decryptedText, decryptedJson }) {
  try {
    await VdApiLog.create({
      type,
      request: {
        headers: safeHeadersForLog({ "x-internal": "vdAutomation" }),
        body: requestBody || {},
        url: url || "",
        method: "POST",
        token: token || "",
      },
      responseRaw: responseRaw || {},
      encrypted: encrypted || "",
      decryptedText: decryptedText || "",
      decryptedJson: decryptedJson || null,
    });
  } catch {
    // ignore
  }
}

function decryptIfPresent(encryptedStr) {
  try {
    if (!encryptedStr || typeof encryptedStr !== "string") return { text: "", json: null };
    if (!VD_SECRET_KEY || !VD_SECRET_IV) return { text: "", json: null };
    const text = vdDecryptBase64(encryptedStr, VD_SECRET_KEY, VD_SECRET_IV);
    if (!text) return { text: "", json: null };
    return { text, json: safeJsonParse(text) };
  } catch {
    return { text: "", json: null };
  }
}

async function upsertJobState(key, patch) {
  await VdJobState.findOneAndUpdate(
    { key },
    { $set: { key, ...(patch || {}) } },
    { upsert: true, new: true }
  );
}

async function refreshTokenIfNeeded() {
  const distributor_id = (process.env.VD_DISTRIBUTOR_ID || "").trim();
  if (!distributor_id) return;

  await upsertJobState("token", { lastRunAt: new Date(), lastStatus: "RUNNING", lastError: "" });

  try {
    const doc = await VdToken.findOne({ distributor_id }).select("expiresAt").lean();
    const expiresAt = doc?.expiresAt ? new Date(doc.expiresAt) : null;

    // If no token OR expires within 24h -> refresh
    const shouldRefresh =
      !expiresAt || (expiresAt.getTime() - Date.now()) < (24 * 3600 * 1000);

    if (!shouldRefresh) {
      await upsertJobState("token", { lastStatus: "OK", lastOkAt: new Date(), meta: { note: "token_still_valid" } });
      return;
    }

    const token = await getVdToken({ force: true });

    if (String(process.env.VD_STORE_TOKEN_PLAIN || "").toLowerCase() === "true") {
      await VdToken.findOneAndUpdate(
        { distributor_id },
        { $set: { token_plain: token || "" } },
        { upsert: true }
      );
    }

    await upsertJobState("token", { lastStatus: "OK", lastOkAt: new Date(), lastError: "" });
  } catch (e) {
    await upsertJobState("token", { lastStatus: "ERROR", lastError: String(e?.message || e) });
  }
}

async function syncBrandsDaily() {
  await upsertJobState("brands", { lastRunAt: new Date(), lastStatus: "RUNNING", lastError: "" });

  try {
    const token = await getVdToken({ force: false });
    assertUrl(URLS.BRANDS, "VD_BRAND_URL");

    const responseRaw = await vdPost(URLS.BRANDS, { BrandCode: "" }, { token }, 30000);
    const encrypted = responseRaw?.data && typeof responseRaw.data === "string" ? responseRaw.data : "";
    const { text: decryptedText, json: decryptedJson } = encrypted ? decryptIfPresent(encrypted) : { text: "", json: null };

    if (Array.isArray(decryptedJson)) {
      const ops = decryptedJson.map((b) => {
        const code = b?.BrandCode || "";
        return {
          updateOne: {
            filter: { BrandCode: code },
            update: {
              $set: {
                BrandCode: code,
                BrandName: b?.BrandName || "",
                Brandtype: b?.Brandtype || "",
                Discount: b?.Discount || "",
                minPrice: typeof b?.minPrice === "number" ? b.minPrice : (b?.minPrice ? Number(b.minPrice) : null),
                maxPrice: typeof b?.maxPrice === "number" ? b.maxPrice : (b?.maxPrice ? Number(b.maxPrice) : null),
                DenominationList: b?.DenominationList || "",
                Category: b?.Category || "",
                Description: b?.Description || "",
                Images: b?.Images || "",
                TnC: b?.TnC || "",
                ImportantInstruction: b?.ImportantInstruction || null,
                RedeemSteps: Array.isArray(b?.RedeemSteps) ? b.RedeemSteps : [],
                raw: b || {},
              },
              // keep your admin fields if already set
              $setOnInsert: { enabled: true },
            },
            upsert: true,
          },
        };
      });

      if (ops.length) await VdBrand.bulkWrite(ops, { ordered: false });
    }

    await logApi({
      type: "BRANDS",
      url: URLS.BRANDS,
      token,
      requestBody: { BrandCode: "" },
      responseRaw,
      encrypted,
      decryptedText,
      decryptedJson,
    });

    await upsertJobState("brands", {
      lastStatus: "OK",
      lastOkAt: new Date(),
      lastError: "",
      meta: { count: Array.isArray(decryptedJson) ? decryptedJson.length : 0 },
    });
  } catch (e) {
    await upsertJobState("brands", { lastStatus: "ERROR", lastError: String(e?.message || e) });
  }
}

// ---- scheduling helpers ----

function msUntilNextHHMM(hh, mm) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hh, mm, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

let started = false;

function initVdAutomation() {
  if (started) return;
  started = true;

  if (!enabled()) {
    return;
  }

  // Token check every 6 hours (safe)
  setTimeout(() => refreshTokenIfNeeded(), 15 * 1000);
  setInterval(() => refreshTokenIfNeeded(), 6 * 3600 * 1000);

  // Brands sync daily at 03:15 server time (India-friendly)
  const delay = msUntilNextHHMM(3, 15);
  setTimeout(() => {
    syncBrandsDaily();
    setInterval(() => syncBrandsDaily(), 24 * 3600 * 1000);
  }, delay);
}

module.exports = {
  initVdAutomation,
  // exporting jobs helps if you want to trigger from CLI/tests
  refreshTokenIfNeeded,
  syncBrandsDaily,
};
