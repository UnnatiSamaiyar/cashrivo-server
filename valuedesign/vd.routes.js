// valuedesign/vd.routes.js
const express = require("express");
const axios = require("axios");

const router = express.Router();

// VD Base URL
const VD_BASE = "http://cards.vdwebapi.com/distributor";

// Axios client
const vd = axios.create({
  baseURL: VD_BASE,
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
  // Token can come from headers or body
  return (
    pick(req.headers, ["token", "Token", "x-token", "x-vd-token"]) ||
    pick(req.body || {}, ["token"])
  );
}

/**
 * 1) Generate Token
 * Spec: POST /api-generatetoken/
 * Headers: username, password
 * Body: { distributor_id }
 */
router.post("/token", async (req, res) => {
  try {
    const distributor_id = pick(req.body || {}, ["distributor_id", "distributorId"], "");

    const username = pick(req.headers, ["username", "Username", "x-username"]) ||
      pick(req.body || {}, ["username"], "");
    const password = pick(req.headers, ["password", "Password", "x-password"]) ||
      pick(req.body || {}, ["password"], "");

    if (!distributor_id) {
      return res.status(400).json({ success: false, message: "distributor_id is required" });
    }
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "username & password are required (in headers or body)" });
    }

    const response = await vd.post(
      "/api-generatetoken/",
      { distributor_id },
      { headers: { username, password } }
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
 * Spec: POST /api-getbrand/
 * Headers: token
 * Body: { BrandCode }
 */
router.post("/brands", async (req, res) => {
  try {
    const token = normalizeToken(req);
    if (!token) {
      return res.status(400).json({ success: false, message: "token is required in headers (token) or body (token)" });
    }

    // BrandCode can be "" to fetch list (as per your testing pattern)
    const BrandCode = pick(req.body || {}, ["BrandCode", "brandCode"], "");

    const response = await vd.post(
      "/api-getbrand/",
      { BrandCode },
      { headers: { token } }
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
 * Spec: POST /api-getstore/
 * Headers: token
 * Body: { BrandCode }
 */
router.post("/stores", async (req, res) => {
  try {
    const token = normalizeToken(req);
    if (!token) {
      return res.status(400).json({ success: false, message: "token is required in headers (token) or body (token)" });
    }

    const BrandCode = pick(req.body || {}, ["BrandCode", "brandCode"], "");
    if (BrandCode === undefined) {
      return res.status(400).json({ success: false, message: "BrandCode is required (can be empty string if VD allows)" });
    }

    const response = await vd.post(
      "/api-getstore/",
      { BrandCode },
      { headers: { token } }
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
 * 4) Get EVC (Generate Electronic Voucher Code)
 * Spec: POST /api-getevc/
 * Headers: token
 * Body: as per spec (order_id, sku_code, distributor_id, no_of_card, amount, receiptNo, curr, firstname, etc.)
 *
 * NOTE: Spec mentions encrypted "payload" in some implementations; here we pass-through raw body.
 */
router.post("/evc", async (req, res) => {
  try {
    const token = normalizeToken(req);
    if (!token) {
      return res.status(400).json({ success: false, message: "token is required in headers (token) or body (token)" });
    }

    const body = req.body || {};
    // Minimal sanity checks (keep it light, you can expand later)
    const order_id = pick(body, ["order_id", "orderId"], null);
    const sku_code = pick(body, ["sku_code", "skuCode"], null);
    const distributor_id = pick(body, ["distributor_id", "distributorId"], null);

    if (!order_id || !sku_code || !distributor_id) {
      return res.status(400).json({
        success: false,
        message: "order_id, sku_code, distributor_id are required in body",
      });
    }

    const response = await vd.post(
      "/api-getevc/",
      body,
      { headers: { token } }
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
 * 5) Get EVC Status
 * Spec: POST /api-getevcstatus/
 * Headers: token
 * Body: { order_id, request_ref_no }
 */
router.post("/evc/status", async (req, res) => {
  try {
    const token = normalizeToken(req);
    if (!token) {
      return res.status(400).json({ success: false, message: "token is required in headers (token) or body (token)" });
    }

    const body = req.body || {};
    const order_id = pick(body, ["order_id", "orderId"], "");
    const request_ref_no = pick(body, ["request_ref_no", "requestRefNo"], "");

    if (!order_id || !request_ref_no) {
      return res.status(400).json({
        success: false,
        message: "order_id and request_ref_no are required",
      });
    }

    const response = await vd.post(
      "/api-getevcstatus/",
      { order_id, request_ref_no },
      { headers: { token } }
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
 * Spec: POST /api-getactivatedevc/
 * Headers: token
 * Body: { order_id, request_ref_no }
 */
router.post("/evc/activated", async (req, res) => {
  try {
    const token = normalizeToken(req);
    if (!token) {
      return res.status(400).json({ success: false, message: "token is required in headers (token) or body (token)" });
    }

    const body = req.body || {};
    const order_id = pick(body, ["order_id", "orderId"], "");
    const request_ref_no = pick(body, ["request_ref_no", "requestRefNo"], "");

    if (!order_id || !request_ref_no) {
      return res.status(400).json({
        success: false,
        message: "order_id and request_ref_no are required",
      });
    }

    const response = await vd.post(
      "/api-getactivatedevc/",
      { order_id, request_ref_no },
      { headers: { token } }
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
 * Spec: POST /api-walletbalance/
 * Headers: token
 * Body: { distributor_id }
 */
router.post("/wallet", async (req, res) => {
  try {
    const token = normalizeToken(req);
    if (!token) {
      return res.status(400).json({ success: false, message: "token is required in headers (token) or body (token)" });
    }

    const distributor_id = pick(req.body || {}, ["distributor_id", "distributorId"], "");
    if (!distributor_id) {
      return res.status(400).json({ success: false, message: "distributor_id is required" });
    }

    const response = await vd.post(
      "/api-walletbalance/",
      { distributor_id },
      { headers: { token } }
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
