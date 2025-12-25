// valuedesign/vd.routes.js
const express = require("express");
const axios = require("axios");

const router = express.Router();

// Base
const VD_BASE = "http://cards.vdwebapi.com/distributor";

// axios client
const vd = axios.create({
  baseURL: VD_BASE,
  timeout: 20000,
});

/**
 * Helpers
 */
function pick(obj, keys, fallback = undefined) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return fallback;
}

function normalizeToken(req) {
  // accept: token / Token / x-token / x-vd-token (headers), or token in body
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

/**
 * 1) Generate Token
 * POST /api-generatetoken/
 * Headers: username, password
 * Body: { distributor_id }
 */
router.post("/token", async (req, res) => {
  try {
    const distributor_id = pick(req.body || {}, ["distributor_id", "distributorId"], "");
    const username =
      pick(req.headers, ["username", "Username", "x-username"], "") ||
      pick(req.body || {}, ["username"], "");
    const password =
      pick(req.headers, ["password", "Password", "x-password"], "") ||
      pick(req.body || {}, ["password"], "");

    if (!distributor_id) {
      return res.status(400).json({ success: false, message: "distributor_id is required" });
    }
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "username & password are required (in headers or body)",
      });
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
 * POST /api-getbrand/
 * Headers: token
 * Body: { BrandCode }
 */
router.post("/brands", async (req, res) => {
  try {
    const token = mustToken(req, res);
    if (!token) return;

    const BrandCode = pick(req.body || {}, ["BrandCode", "brandCode"], ""); // "" allowed
    const response = await vd.post("/api-getbrand/", { BrandCode }, { headers: { token } });

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
 * POST /api-getstore/
 * Headers: token
 * Body: { BrandCode }
 */
router.post("/stores", async (req, res) => {
  try {
    const token = mustToken(req, res);
    if (!token) return;

    const BrandCode = pick(req.body || {}, ["BrandCode", "brandCode"], "");
    const response = await vd.post("/api-getstore/", { BrandCode }, { headers: { token } });

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
 * 4) Get EVC (Correct endpoint: /getevc/)
 * POST /getevc/
 * Headers: token
 * Body: as per doc fields (order_id, sku_code, distributor_id, no_of_card, amount, receiptNo, curr, firstname, lastname, mobile_no, email, address, city, state, country, pincode?, reqId?)
 */
router.post("/evc", async (req, res) => {
  try {
    const token = mustToken(req, res);
    if (!token) return;

    const body = req.body || {};

    // Minimal required checks (doc)
    const order_id = pick(body, ["order_id", "orderId"], "");
    const sku_code = pick(body, ["sku_code", "skuCode"], "");
    const distributor_id = pick(body, ["distributor_id", "distributorId"], "");
    const no_of_card = pick(body, ["no_of_card", "noOfCard"], "");
    const amount = pick(body, ["amount"], "");
    const receiptNo = pick(body, ["receiptNo", "receipt_no", "receipt"], "");
    const curr = pick(body, ["curr", "currency", "currency_code"], "");

    if (!order_id || !sku_code || !distributor_id || !no_of_card || !amount || !receiptNo || !curr) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields. Need: order_id, sku_code, distributor_id, no_of_card, amount, receiptNo, curr (plus user details fields as per VD).",
      });
    }

    const response = await vd.post("/getevc/", body, { headers: { token } });
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
 * 5) Get EVC Status (Correct endpoint: /getevcstatus/)
 * POST /getevcstatus/
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

    const response = await vd.post(
      "/getevcstatus/",
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
 * 6) Get Activated EVC (Correct endpoint: /getactivatedevc/)
 * POST /getactivatedevc/
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

    const response = await vd.post(
      "/getactivatedevc/",
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
 * 7) Wallet Balance (Correct endpoint: /getwalletbalance/)
 * POST /getwalletbalance/
 * Headers: token
 * Body: { distributor_id }
 */
router.post("/wallet", async (req, res) => {
  try {
    const token = mustToken(req, res);
    if (!token) return;

    const distributor_id = pick(req.body || {}, ["distributor_id", "distributorId"], "");
    if (!distributor_id) {
      return res.status(400).json({ success: false, message: "distributor_id is required" });
    }

    const response = await vd.post(
      "/getwalletbalance/",
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
