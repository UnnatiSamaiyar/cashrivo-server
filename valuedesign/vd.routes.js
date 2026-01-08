// valuedesign/vd.routes.js
const express = require("express");
const axios = require("axios");

const router = express.Router();

/**
 * ENV (safe defaults)
 * Prefer per-endpoint URLs from env; fallback to VD_BASE if provided.
 */
const VD_BASE = (process.env.VD_BASE || "").replace(/\/+$/, ""); // no trailing /
const URLS = {
  TOKEN: process.env.VD_TOKEN_URL || (VD_BASE ? `${VD_BASE}/api-generatetoken/` : ""),
  BRANDS: process.env.VD_BRAND_URL || (VD_BASE ? `${VD_BASE}/api-getbrand/` : ""),
  STORES: process.env.VD_STORE_URL || (VD_BASE ? `${VD_BASE}/api-getstore/` : ""),
  EVC: process.env.VD_EVC_URL || (VD_BASE ? `${VD_BASE}/getevc/` : ""),
  EVC_STATUS: process.env.VD_EVC_STATUS_URL || (VD_BASE ? `${VD_BASE}/getevcstatus/` : ""),
  EVC_ACTIVATED: process.env.VD_EVC_ACTIVATED_URL || (VD_BASE ? `${VD_BASE}/getactivatedevc/` : ""),
  WALLET: process.env.VD_WALLET_URL || (VD_BASE ? `${VD_BASE}/getwalletbalance/` : ""),
};

// axios client (used when we have only baseURL style endpoints)
const vd = axios.create({
  baseURL: VD_BASE || undefined,
  timeout: 20000,
});

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

function assertUrl(res, url, name) {
  if (!url) {
    res.status(500).json({
      success: false,
      message: `${name} URL missing. Set VD_BASE or ${name} env URL.`,
    });
    return false;
  }
  return true;
}

/**
 * 1) Generate Token
 * POST /api/vd/token
 * Headers: username, password (optional if present in env)
 * Body: { distributor_id } (optional if present in env)
 */
router.post("/token", async (req, res) => {
  try {
    const distributor_id =
      pick(req.body || {}, ["distributor_id", "distributorId"], "") ||
      process.env.VD_DISTRIBUTOR_ID;

    const username =
      pick(req.headers, ["username", "Username", "x-username"], "") ||
      pick(req.body || {}, ["username"], "") ||
      process.env.VD_USERNAME;

    const password =
      pick(req.headers, ["password", "Password", "x-password"], "") ||
      pick(req.body || {}, ["password"], "") ||
      process.env.VD_PASSWORD;

    if (!distributor_id) {
      return res.status(400).json({ success: false, message: "distributor_id is required" });
    }
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "username & password are required (in headers/body or env VD_USERNAME/VD_PASSWORD)",
      });
    }

    if (!assertUrl(res, URLS.TOKEN, "VD_TOKEN_URL")) return;

    const response = await axios.post(
      URLS.TOKEN,
      { distributor_id },
      { headers: { username, password }, timeout: 20000 }
    );

    return res.json({ success: true, response: response.data });
  } catch (err) {
    return res.status(500).json({
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
 */
router.post("/brands", async (req, res) => {
  try {
    const token = mustToken(req, res);
    if (!token) return;

    const BrandCode = pick(req.body || {}, ["BrandCode", "brandCode"], ""); // "" allowed

    if (!assertUrl(res, URLS.BRANDS, "VD_BRAND_URL")) return;

    const response = await axios.post(
      URLS.BRANDS,
      { BrandCode },
      { headers: { token }, timeout: 20000 }
    );

    return res.json({ success: true, response: response.data });
  } catch (err) {
    return res.status(500).json({
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
 */
router.post("/stores", async (req, res) => {
  try {
    const token = mustToken(req, res);
    if (!token) return;

    const BrandCode = pick(req.body || {}, ["BrandCode", "brandCode"], "");

    if (!assertUrl(res, URLS.STORES, "VD_STORE_URL")) return;

    const response = await axios.post(
      URLS.STORES,
      { BrandCode },
      { headers: { token }, timeout: 20000 }
    );

    return res.json({ success: true, response: response.data });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
      vd_error: err.response?.data || null,
    });
  }
});

/**
 * 4) Get EVC (PROD as per mail)
 * POST /api/vd/evc
 * Headers: token
 * Body: { payload: "<encrypted string>" }
 *
 * IMPORTANT: We forward ONLY { payload } to VD exactly.
 */
router.post("/evc", async (req, res) => {
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

    if (!assertUrl(res, URLS.EVC, "VD_EVC_URL")) return;

    const vdResponse = await axios.post(
      URLS.EVC,
      { payload },
      { headers: { token }, timeout: 20000 }
    );

    return res.json({ success: true, response: vdResponse.data });
  } catch (err) {
    return res.status(500).json({
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
 */
router.post("/evc/status", async (req, res) => {
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

    if (!assertUrl(res, URLS.EVC_STATUS, "VD_EVC_STATUS_URL")) return;

    const response = await axios.post(
      URLS.EVC_STATUS,
      { order_id, request_ref_no },
      { headers: { token }, timeout: 20000 }
    );

    return res.json({ success: true, response: response.data });
  } catch (err) {
    return res.status(500).json({
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
 */
router.post("/evc/activated", async (req, res) => {
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

    if (!assertUrl(res, URLS.EVC_ACTIVATED, "VD_EVC_ACTIVATED_URL")) return;

    const response = await axios.post(
      URLS.EVC_ACTIVATED,
      { order_id, request_ref_no },
      { headers: { token }, timeout: 20000 }
    );

    return res.json({ success: true, response: response.data });
  } catch (err) {
    return res.status(500).json({
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
 */
router.post("/wallet", async (req, res) => {
  try {
    const token = mustToken(req, res);
    if (!token) return;

    const distributor_id =
      pick(req.body || {}, ["distributor_id", "distributorId"], "") ||
      process.env.VD_DISTRIBUTOR_ID;

    if (!distributor_id) {
      return res.status(400).json({ success: false, message: "distributor_id is required" });
    }

    if (!assertUrl(res, URLS.WALLET, "VD_WALLET_URL")) return;

    const response = await axios.post(
      URLS.WALLET,
      { distributor_id },
      { headers: { token }, timeout: 20000 }
    );

    return res.json({ success: true, response: response.data });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
      vd_error: err.response?.data || null,
    });
  }
});

module.exports = router;
