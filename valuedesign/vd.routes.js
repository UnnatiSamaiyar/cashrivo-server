// valuedesign/vd.routes.js
const express = require("express");
const { assertUrl, vdPost } = require("../services/vdClient");
const { vdDecryptBase64, safeJsonParse } = require("../utils/vdCrypto");
const { getVdToken } = require("../services/vdTokenCache");

const VdApiLog = require("../models/VdApiLog");
const VdBrand = require("../models/VdBrand");
const VdStore = require("../models/VdStore");
const VdEvcOrder = require("../models/VdEvcOrder");
const VdWallet = require("../models/VdWallet");

const router = express.Router();

const VD_MODE = (process.env.VD_MODE || "LIVE").trim().toUpperCase(); // LIVE | MOCK

/**
 * ENV (safe defaults)
 */
const VD_BASE = (process.env.VD_BASE || "").replace(/\/+$/, "");
const URLS = {
  TOKEN: process.env.VD_TOKEN_URL || (VD_BASE ? `${VD_BASE}/api-generatetoken/` : ""),
  BRANDS: process.env.VD_BRAND_URL || (VD_BASE ? `${VD_BASE}/api-getbrand/` : ""),
  STORES: process.env.VD_STORE_URL || (VD_BASE ? `${VD_BASE}/api-getstore/` : ""),
  EVC: process.env.VD_EVC_URL || (VD_BASE ? `${VD_BASE}/getevc/` : ""),
  EVC_STATUS: process.env.VD_EVC_STATUS_URL || (VD_BASE ? `${VD_BASE}/getevcstatus/` : ""),
  EVC_ACTIVATED: process.env.VD_EVC_ACTIVATED_URL || (VD_BASE ? `${VD_BASE}/getactivatedevc/` : ""),
  WALLET: process.env.VD_WALLET_URL || (VD_BASE ? `${VD_BASE}/getwalletbalance/` : ""),
};

// Decrypt env (must be set in production)
const VD_SECRET_KEY = (process.env.VD_SECRET_KEY || "").trim();
const VD_SECRET_IV = (process.env.VD_SECRET_IV || "").trim();

/**
 * Helpers
 */
function pick(obj, keys, fallback = undefined) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return fallback;
}

function normalizeToken(req) {
  return (
    pick(req.headers, ["token", "Token", "x-token", "x-vd-token"], "") ||
    pick(req.body || {}, ["token"], "")
  );
}

function mustToken(req, res) {
  const token = normalizeToken(req);
  if (!token) {
    res.status(400).json({
      success: false,
      message: "token is required in headers (token) or body (token)",
    });
    return null;
  }
  return token;
}

function safeHeadersForLog(headers) {
  const h = headers || {};
  // remove secrets from log, but keep operational metadata
  const clone = { ...h };
  if (clone.password) clone.password = "***";
  if (clone.Password) clone.Password = "***";
  if (clone["x-password"]) clone["x-password"] = "***";
  return clone;
}

async function logApi({ type, req, url, token, requestBody, responseRaw, encrypted, decryptedText, decryptedJson, refs }) {
  try {
    await VdApiLog.create({
      type,
      request: {
        headers: safeHeadersForLog(req.headers),
        body: requestBody || {},
        url: url || "",
        method: "POST",
        token: token || "",
      },
      responseRaw: responseRaw || {},
      encrypted: encrypted || "",
      decryptedText: decryptedText || "",
      decryptedJson: decryptedJson || null,
      order_id: refs?.order_id || "",
      request_ref_no: refs?.request_ref_no || "",
      brandCode: refs?.BrandCode || refs?.brandCode || "",
      distributor_id: refs?.distributor_id || "",
    });
  } catch (e) {
    // do not fail API for logging issues
  }
}

function decryptIfPresent(encryptedStr) {
  try {
    if (!encryptedStr || typeof encryptedStr !== "string") return { text: "", json: null };
    if (!VD_SECRET_KEY || !VD_SECRET_IV) return { text: "", json: null };
    const text = vdDecryptBase64(encryptedStr, VD_SECRET_KEY, VD_SECRET_IV);

    // If decrypt fails -> null, but API should still return raw response
    if (!text) return { text: "", json: null };

    const parsed = safeJsonParse(text);
    return { text, json: parsed };
  } catch {
    return { text: "", json: null };
  }
}


/**
 * 1) Generate Token
 * POST /api/vd/token
 */
router.post("/token", async (req, res) => {
  const url = URLS.TOKEN;

  try {
    // IMPORTANT:
    // Token is valid for 7 days (VD). In production we should NOT generate it on every call.
    // This endpoint returns cached token by default.
    const force = String(req.query.force || "").toLowerCase() === "true" || String(req.query.force || "") === "1";
    const token = await getVdToken({ force });

    return res.json({
      success: true,
      token: token ? `${token.slice(0, 6)}***${token.slice(-4)}` : "",
      note: force ? "token_regenerated" : "token_from_cache",
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      vd_error: err.response?.data || null,
    });
  }
});

/**
 * 2) Get Brands
 * POST /api/vd/brands
 * Headers: token
 * Body: { BrandCode }
 *
 * Saves into VdBrand collection (upsert by BrandCode)
 */
router.post("/brands", async (req, res) => {
  const url = URLS.BRANDS;

  try {
    const token = mustToken(req, res);
    if (!token) return;

    const BrandCode = pick(req.body || {}, ["BrandCode", "brandCode"], "");

    assertUrl(url, "VD_BRAND_URL");

    const responseRaw = await vdPost(url, { BrandCode }, { token }, 20000);

    // Usually encrypted at responseRaw.data
    const encrypted = responseRaw?.data && typeof responseRaw.data === "string" ? responseRaw.data : "";
    const { text: decryptedText, json: decryptedJson } = encrypted ? decryptIfPresent(encrypted) : { text: "", json: null };

    // decryptedJson for brands is usually an array of brand objects
    if (Array.isArray(decryptedJson)) {
      const ops = decryptedJson.map((b) => {
        const code = b?.BrandCode || BrandCode || "";
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
            },
            upsert: true,
          },
        };
      });

      if (ops.length) await VdBrand.bulkWrite(ops, { ordered: false });
    }

    await logApi({
      type: "BRANDS",
      req,
      url,
      token,
      requestBody: { BrandCode },
      responseRaw,
      encrypted,
      decryptedText,
      decryptedJson,
      refs: { BrandCode },
    });

    return res.json({
      success: true,
      response: responseRaw,
      decrypted: decryptedJson || decryptedText || null,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      vd_error: err.response?.data || null,
    });
  }
});

/**
 * 3) Get Store List
 * POST /api/vd/stores
 * Headers: token
 * Body: { BrandCode }
 *
 * Saves into VdStore collection (upsert by BrandCode+StoreCode when present)
 */
router.post("/stores", async (req, res) => {
  const url = URLS.STORES;

  try {
    const token = mustToken(req, res);
    if (!token) return;

    const BrandCode = pick(req.body || {}, ["BrandCode", "brandCode"], "");

    assertUrl(url, "VD_STORE_URL");

    const responseRaw = await vdPost(url, { BrandCode }, { token }, 20000);

    const encrypted = responseRaw?.data && typeof responseRaw.data === "string" ? responseRaw.data : "";
    const { text: decryptedText, json: decryptedJson } = encrypted ? decryptIfPresent(encrypted) : { text: "", json: null };

    // store list is commonly an array
    if (Array.isArray(decryptedJson)) {
      const ops = decryptedJson.map((s) => {
        const storeCode = s?.StoreCode || s?.storeCode || s?.OutletCode || "";
        return {
          updateOne: {
            filter: { BrandCode: s?.BrandCode || BrandCode || "", StoreCode: storeCode || "" },
            update: {
              $set: {
                BrandCode: s?.BrandCode || BrandCode || "",
                StoreCode: storeCode || "",
                StoreName: s?.StoreName || s?.storeName || "",
                City: s?.City || "",
                State: s?.State || "",
                Address: s?.Address || "",
                Pincode: s?.Pincode || "",
                Phone: s?.Phone || "",
                Email: s?.Email || "",
                Latitude: s?.Latitude || "",
                Longitude: s?.Longitude || "",
                raw: s || {},
              },
            },
            upsert: true,
          },
        };
      });

      if (ops.length) await VdStore.bulkWrite(ops, { ordered: false });
    }

    await logApi({
      type: "STORES",
      req,
      url,
      token,
      requestBody: { BrandCode },
      responseRaw,
      encrypted,
      decryptedText,
      decryptedJson,
      refs: { BrandCode },
    });

    return res.json({
      success: true,
      response: responseRaw,
      decrypted: decryptedJson || decryptedText || null,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      vd_error: err.response?.data || null,
    });
  }
});

/**
 * 4) Get EVC
 * POST /api/vd/evc
 * Headers: token
 * Body: { payload: "<encrypted string>" }
 *
 * Saves into VdEvcOrder with decrypted data.
 */
router.post("/evc", async (req, res) => {
  const url = URLS.EVC;

  if (VD_MODE === "MOCK") {
    const payload = pick(req.body || {}, ["payload"], "");
    // In MOCK, we cannot decrypt vendor payload; we only simulate a successful issuance.
    const order_id = `MOCK_${Date.now()}`;
    const request_ref_no = `MOCKREF_${Date.now()}`;
    const decrypted = { cards: [{ card_no: "MOCK-XXXX-YYYY-ZZZZ", pin: "1234", expiry: "2027-12-31" }], mode: "MOCK" };
    return res.json({
      success: true,
      response: {
        responseCode: "0",
        responseMsg: "SUCCESS",
        status: "SUCCESS",
        order_id,
        request_ref_no,
        data: "",
        mode: "MOCK",
      },
      decrypted,
      note: "VD_MODE=MOCK",
    });
  }

  try {
    const token = mustToken(req, res);
    if (!token) return;

    const payload = pick(req.body || {}, ["payload"], "");
    if (!payload) {
      return res.status(400).json({
        success: false,
        message: "payload missing (encrypted string required)",
      });
    }

    assertUrl(url, "VD_EVC_URL");

    const responseRaw = await vdPost(url, { payload }, { token }, 20000);

    // Typical: responseRaw contains responseCode/Msg/order_id/request_ref_no + encrypted data in responseRaw.data
    const order_id = responseRaw?.order_id || responseRaw?.response?.order_id || "";
    const request_ref_no = responseRaw?.request_ref_no || responseRaw?.response?.request_ref_no || "";

    // Some implementations wrap it: { success:true, response:{...} }
    const inner = responseRaw?.response ? responseRaw.response : responseRaw;

    const encryptedData = inner?.data && typeof inner.data === "string" ? inner.data : "";
    const { text: decryptedText, json: decryptedJson } = encryptedData
      ? decryptIfPresent(encryptedData)
      : { text: "", json: null };

    // Persist order (upsert by order_id+request_ref_no if present)
    await VdEvcOrder.findOneAndUpdate(
      { order_id: inner?.order_id || order_id || "", request_ref_no: inner?.request_ref_no || request_ref_no || "" },
      {
        $set: {
          order_id: inner?.order_id || order_id || "",
          request_ref_no: inner?.request_ref_no || request_ref_no || "",
          responseCode: inner?.responseCode || "",
          responseMsg: inner?.responseMsg || "",
          status: inner?.status || "",
          encryptedData: encryptedData || "",
          decryptedText: decryptedText || "",
          decryptedJson: decryptedJson || null,
          requestPayloadEncrypted: payload,
          tokenUsed: token,
        },
      },
      { upsert: true, new: true }
    );

    await logApi({
      type: "EVC",
      req,
      url,
      token,
      requestBody: { payload },
      responseRaw,
      encrypted: encryptedData,
      decryptedText,
      decryptedJson,
      refs: { order_id: inner?.order_id || order_id, request_ref_no: inner?.request_ref_no || request_ref_no },
    });

    return res.json({
      success: true,
      response: responseRaw,
      decrypted: decryptedJson || decryptedText || null,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      vd_error: err.response?.data || null,
    });
  }
});

/**
 * 5) Get EVC Status
 * POST /api/vd/evc/status
 * Headers: token
 * Body: { order_id, request_ref_no }
 *
 * Logs + updates VdEvcOrder.lastStatusRaw
 */
router.post("/evc/status", async (req, res) => {
  const url = URLS.EVC_STATUS;

  try {
    const token = mustToken(req, res);
    if (!token) return;

    const order_id = pick(req.body || {}, ["order_id", "orderId"], "");
    const request_ref_no = pick(req.body || {}, ["request_ref_no", "requestRefNo"], "");

    if (!order_id || !request_ref_no) {
      return res.status(400).json({
        success: false,
        message: "order_id and request_ref_no are required",
      });
    }

    assertUrl(url, "VD_EVC_STATUS_URL");

    const responseRaw = await vdPost(url, { order_id, request_ref_no }, { token }, 20000);

    // Update order doc
    await VdEvcOrder.findOneAndUpdate(
      { order_id, request_ref_no },
      { $set: { lastStatusRaw: responseRaw, tokenUsed: token } },
      { upsert: true, new: true }
    );

    await logApi({
      type: "EVC_STATUS",
      req,
      url,
      token,
      requestBody: { order_id, request_ref_no },
      responseRaw,
      encrypted: "",
      decryptedText: "",
      decryptedJson: null,
      refs: { order_id, request_ref_no },
    });

    return res.json({ success: true, response: responseRaw });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      vd_error: err.response?.data || null,
    });
  }
});

/**
 * 6) Get Activated EVC
 * POST /api/vd/evc/activated
 * Headers: token
 * Body: { order_id, request_ref_no }
 *
 * Updates VdEvcOrder.lastActivatedRaw
 */
router.post("/evc/activated", async (req, res) => {
  const url = URLS.EVC_ACTIVATED;

  try {
    const token = mustToken(req, res);
    if (!token) return;

    const order_id = pick(req.body || {}, ["order_id", "orderId"], "");
    const request_ref_no = pick(req.body || {}, ["request_ref_no", "requestRefNo"], "");

    if (!order_id || !request_ref_no) {
      return res.status(400).json({
        success: false,
        message: "order_id and request_ref_no are required",
      });
    }

    assertUrl(url, "VD_EVC_ACTIVATED_URL");

    const responseRaw = await vdPost(url, { order_id, request_ref_no }, { token }, 20000);

    await VdEvcOrder.findOneAndUpdate(
      { order_id, request_ref_no },
      { $set: { lastActivatedRaw: responseRaw, tokenUsed: token } },
      { upsert: true, new: true }
    );

    await logApi({
      type: "EVC_ACTIVATED",
      req,
      url,
      token,
      requestBody: { order_id, request_ref_no },
      responseRaw,
      encrypted: "",
      decryptedText: "",
      decryptedJson: null,
      refs: { order_id, request_ref_no },
    });

    return res.json({ success: true, response: responseRaw });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      vd_error: err.response?.data || null,
    });
  }
});

/**
 * 7) Wallet Balance
 * POST /api/vd/wallet
 * Headers: token
 * Body: { distributor_id }
 *
 * Saves last wallet response as log + VdWallet doc
 */
router.post("/wallet", async (req, res) => {
  const url = URLS.WALLET;

  if (VD_MODE === "MOCK") {
    return res.json({
      success: true,
      response: {
        responseCode: "0",
        responseMsg: "APPROVAL",
        walletdetails: {
          clientName: "Cashrivo (MOCK)",
          currency: "INR",
          balance: "999999.00",
          responseTimestamp: String(Date.now()),
        },
      },
      decrypted: null,
      note: "VD_MODE=MOCK",
    });
  }

  try {
    const token = mustToken(req, res);
    if (!token) return;

    const distributor_id =
      pick(req.body || {}, ["distributor_id", "distributorId"], "") ||
      process.env.VD_DISTRIBUTOR_ID;

    if (!distributor_id) {
      return res.status(400).json({ success: false, message: "distributor_id is required" });
    }

    assertUrl(url, "VD_WALLET_URL");

    const responseRaw = await vdPost(url, { distributor_id }, { token }, 20000);

    const encryptedData = responseRaw?.data && typeof responseRaw.data === "string" ? responseRaw.data : "";
    const { text: decryptedText, json: decryptedJson } = encryptedData
      ? decryptIfPresent(encryptedData)
      : { text: "", json: null };

    await VdWallet.create({
      distributor_id,
      tokenUsed: token,
      responseCode: responseRaw?.responseCode || "",
      responseMsg: responseRaw?.responseMsg || "",
      encryptedData: encryptedData || "",
      decryptedText: decryptedText || "",
      decryptedJson: decryptedJson || null,
      raw: responseRaw || {},
    });

    await logApi({
      type: "WALLET",
      req,
      url,
      token,
      requestBody: { distributor_id },
      responseRaw,
      encrypted: encryptedData,
      decryptedText,
      decryptedJson,
      refs: { distributor_id },
    });

    return res.json({
      success: true,
      response: responseRaw,
      decrypted: decryptedJson || decryptedText || null,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      vd_error: err.response?.data || null,
    });
  }
});

// --- ADMIN READ APIs (MongoDB se) ---

// GET /api/vd/db/brands?search=&page=1&limit=50
router.get("/db/brands", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1"), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "50"), 1), 200);
    const search = (req.query.search || "").toString().trim();

    const q = {};
    if (search) {
      q.$or = [
        { BrandCode: { $regex: search, $options: "i" } },
        { BrandName: { $regex: search, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      VdBrand.find(q).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit),
      VdBrand.countDocuments(q),
    ]);

    res.json({ success: true, page, limit, total, items });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/vd/db/stores?brandCode=&search=&page=1&limit=50
router.get("/db/stores", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1"), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "50"), 1), 200);
    const brandCode = (req.query.brandCode || "").toString().trim();
    const search = (req.query.search || "").toString().trim();

    const q = {};
    if (brandCode) q.BrandCode = brandCode;
    if (search) {
      q.$or = [
        { StoreCode: { $regex: search, $options: "i" } },
        { StoreName: { $regex: search, $options: "i" } },
        { City: { $regex: search, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      VdStore.find(q).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit),
      VdStore.countDocuments(q),
    ]);

    res.json({ success: true, page, limit, total, items });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/vd/db/orders?search=&page=1&limit=50
router.get("/db/orders", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1"), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "50"), 1), 200);
    const search = (req.query.search || "").toString().trim();

    const q = {};
    if (search) {
      q.$or = [
        { order_id: { $regex: search, $options: "i" } },
        { request_ref_no: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      VdEvcOrder.find(q).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit),
      VdEvcOrder.countDocuments(q),
    ]);

    res.json({ success: true, page, limit, total, items });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/vd/db/logs?type=&search=&page=1&limit=50
router.get("/db/logs", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1"), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "50"), 1), 200);
    const type = (req.query.type || "").toString().trim();
    const search = (req.query.search || "").toString().trim();

    const q = {};
    if (type) q.type = type;
    if (search) {
      q.$or = [
        { "request.url": { $regex: search, $options: "i" } },
        { order_id: { $regex: search, $options: "i" } },
        { request_ref_no: { $regex: search, $options: "i" } },
        { brandCode: { $regex: search, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      VdApiLog.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      VdApiLog.countDocuments(q),
    ]);

    res.json({ success: true, page, limit, total, items });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});


module.exports = router;
