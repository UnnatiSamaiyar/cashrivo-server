// routes/giftcards.js
"use strict";

const express = require("express");
const crypto = require("crypto");
const Razorpay = require("razorpay");

const auth = require("../middleware/auth");
const VdBrand = require("../models/VdBrand");
const VdStore = require("../models/VdStore");
const GiftcardPurchase = require("../models/GiftcardPurchase");
const User = require("../models/User");

const { assertUrl, vdPost } = require("../services/vdClient");
const { getVdToken } = require("../services/vdTokenCache");
const { vdEncryptBase64 } = require("../utils/vdEncrypt");
const { vdDecryptBase64, safeJsonParse } = require("../utils/vdCrypto");
const { encryptJson, decryptJson } = require("../utils/secretBox");
const { sendMail } = require("../services/mailer");

const router = express.Router();

// Razorpay
const key_id = process.env.RAZORPAY_KEY_ID;
const key_secret = process.env.RAZORPAY_KEY_SECRET;
const razorpay = new Razorpay({ key_id, key_secret });

// ValueDesign
const VD_BASE = (process.env.VD_BASE || "").replace(/\/+$/, "");
const VD_EVC_URL = (
  process.env.VD_EVC_URL || (VD_BASE ? `${VD_BASE}/getevc/` : "")
).trim();
const VD_SECRET_KEY = (process.env.VD_SECRET_KEY || "").trim();
const VD_SECRET_IV = (process.env.VD_SECRET_IV || "").trim();
const VD_DISTRIBUTOR_ID = (process.env.VD_DISTRIBUTOR_ID || "").trim();

/* -----------------------------
 * Helpers
 * ----------------------------- */

function parseDenoms(list) {
  if (!list) return [];
  return String(list)
    .split(",")
    .map((x) => Number(String(x).trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
}

function verifyRazorpaySignature({ order_id, payment_id, signature }) {
  const body = `${order_id}|${payment_id}`;
  const expected = crypto
    .createHmac("sha256", key_secret)
    .update(body)
    .digest("hex");
  return expected === signature;
}

function maskVouchers(vouchers) {
  if (!vouchers) return null;
  try {
    const list = Array.isArray(vouchers)
      ? vouchers
      : vouchers?.cards ||
        vouchers?.CardDetails ||
        vouchers?.card_details ||
        vouchers?.data ||
        null;
    if (!Array.isArray(list)) return { available: true };
    return list.map((c) => {
      const code = String(
        c?.card_no || c?.CardNo || c?.code || c?.voucher_no || "",
      );
      const last4 = code ? code.slice(-4) : "";
      return {
        label: c?.brand || c?.BrandName || "Gift Card",
        code_last4: last4,
        expiry: c?.expiry || c?.Expiry || c?.valid_till || "",
      };
    });
  } catch {
    return { available: true };
  }
}

function splitName(fullName) {
  const n = String(fullName || "").trim();
  if (!n) return { first: "", last: "" };
  const parts = n.split(/\s+/g).filter(Boolean);
  return { first: parts[0] || "", last: parts.slice(1).join(" ") || "" };
}

function safeMobile(m) {
  const s = String(m || "")
    .replace(/\D/g, "")
    .slice(-10);
  return s;
}

function vdUrls() {
  return {
    BRANDS: (
      process.env.VD_BRAND_URL || (VD_BASE ? `${VD_BASE}/api-getbrand/` : "")
    ).trim(),
    STORES: (
      process.env.VD_STORE_URL || (VD_BASE ? `${VD_BASE}/api-getstore/` : "")
    ).trim(),
    EVC: VD_EVC_URL,
  };
}

function decryptVdResponseData(encryptedStr) {
  if (!encryptedStr) return { text: "", json: null };
  if (!VD_SECRET_KEY || !VD_SECRET_IV) return { text: "", json: null };
  const text = vdDecryptBase64(encryptedStr, VD_SECRET_KEY, VD_SECRET_IV);
  if (!text) return { text: "", json: null };
  return { text, json: safeJsonParse(text) };
}

async function callVdEvc({ token, payloadObj }) {
  const { EVC } = vdUrls();
  assertUrl(EVC, "VD_EVC_URL");
  if (!VD_SECRET_KEY || !VD_SECRET_IV) {
    throw new Error("VD_SECRET_KEY / VD_SECRET_IV missing in env");
  }
  if (!VD_DISTRIBUTOR_ID) {
    throw new Error("VD_DISTRIBUTOR_ID missing in env");
  }

  // VD expects encrypted payload string in body: { payload: "..." }
  const payloadEncrypted = vdEncryptBase64(
    JSON.stringify(payloadObj),
    VD_SECRET_KEY,
    VD_SECRET_IV,
  );
  const responseRaw = await vdPost(
    EVC,
    { payload: payloadEncrypted },
    { token },
    30000,
  );

  // VD responses commonly include encrypted payload in `data`
  const encryptedData =
    typeof responseRaw?.data === "string" ? responseRaw.data : "";
  const dec = encryptedData
    ? decryptVdResponseData(encryptedData)
    : { text: "", json: null };

  return {
    responseRaw,
    encryptedPayload: payloadEncrypted,
    encryptedData,
    decryptedText: dec.text,
    decryptedJson: dec.json,
  };
}

function extractVouchersFromDecrypted(decryptedJson) {
  // Do NOT over-assume vendor schema; store full object.
  // Many VD integrations return an array of cards under keys like:
  // - cards
  // - CardDetails
  // - brand_details[0].items
  if (!decryptedJson) return null;

  if (Array.isArray(decryptedJson)) return decryptedJson;
  if (Array.isArray(decryptedJson?.cards)) return decryptedJson.cards;
  if (Array.isArray(decryptedJson?.CardDetails))
    return decryptedJson.CardDetails;

  const bd = decryptedJson?.brand_details;
  if (Array.isArray(bd) && Array.isArray(bd?.[0]?.items)) return bd[0].items;

  return decryptedJson;
}

function buildGiftCardEmailHtml({ brandName, totalAmount, orderId, vouchers }) {
  const masked = maskVouchers(vouchers);
  const lines = Array.isArray(masked)
    ? masked
        .map(
          (v, i) =>
            `<li style="margin:0 0 6px 0;">Card ${i + 1}: •••• ${v.code_last4}${v.expiry ? ` (Expiry: ${v.expiry})` : ""}</li>`,
        )
        .join("")
    : `<li>Your gift card is ready.</li>`;

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#111;">
    <div style="padding:14px 16px;border-radius:14px;background:#0b1220;color:#fff;">
      <div style="font-size:18px;font-weight:700;">Cashrivo Gift Card Delivery</div>
      <div style="opacity:.9;margin-top:4px;">${brandName}</div>
    </div>
    <div style="padding:16px 6px;">
      <div style="font-size:14px;opacity:.85;">Order ID: <b>${orderId}</b></div>
      <div style="font-size:14px;opacity:.85;margin-top:4px;">Total: <b>₹${Number(totalAmount || 0).toFixed(2)}</b></div>
      <div style="margin-top:14px;padding:14px;border:1px solid #e5e7eb;border-radius:14px;background:#fff;">
        <div style="font-weight:700;margin-bottom:8px;">Your card(s) are ready</div>
        <div style="font-size:13px;opacity:.85;margin-bottom:8px;">For security, this email shows a masked preview. Please sign in to Cashrivo → Profile → Gift Card Orders to view full details.</div>
        <ul style="padding-left:18px;margin:0;">${lines}</ul>
      </div>
      <div style="margin-top:14px;font-size:12px;opacity:.75;">If you did not place this order, please contact support immediately.</div>
    </div>
  </div>`;
}

/* -----------------------------
 * Catalog APIs
 * ----------------------------- */

// GET /api/giftcards/catalog
router.get("/catalog", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 60)));
    const q = String(req.query.q || "").trim();
    const category = String(req.query.category || "all");
    const sort = String(req.query.sort || "discount_desc");

    const filter = {};
    if (category && category !== "all") filter.Category = category;
    if (q) {
      filter.$or = [
        { BrandName: { $regex: q, $options: "i" } },
        { BrandCode: { $regex: q, $options: "i" } },
        { Category: { $regex: q, $options: "i" } },
      ];
    }

    const sortSpec = (() => {
      if (sort === "name_asc") return { BrandName: 1 };
      if (sort === "name_desc") return { BrandName: -1 };
      if (sort === "discount_asc") return { Discount: 1 };
      return { Discount: -1 };
    })();

    const total = await VdBrand.countDocuments(filter);
    const items = await VdBrand.find(filter)
      .sort(sortSpec)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      items,
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// POST /api/giftcards/sync
// Optional header: x-admin-key (set ADMIN_SYNC_KEY). If ADMIN_SYNC_KEY not set, route is open.
router.post("/sync", async (req, res) => {
  try {
    const adminKey = process.env.ADMIN_SYNC_KEY;
    if (adminKey && String(req.headers["x-admin-key"] || "") !== adminKey) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const token = await getVdToken({ force: Boolean(req.query.force) });
    const { BRANDS, STORES } = vdUrls();

    // Fetch brands
    assertUrl(BRANDS, "VD_BRAND_URL");
    const brandsRaw = await vdPost(BRANDS, { BrandCode: "" }, { token }, 30000);
    const brandsEncrypted =
      typeof brandsRaw?.data === "string" ? brandsRaw.data : "";
    const brandsDec = brandsEncrypted
      ? decryptVdResponseData(brandsEncrypted).json
      : null;

    let brandsUpserted = 0;
    if (Array.isArray(brandsDec)) {
      for (const b of brandsDec) {
        const BrandCode = b?.BrandCode || b?.brandCode;
        if (!BrandCode) continue;

        const denoms = b?.DenominationList ? String(b.DenominationList) : "";
        const denArr = parseDenoms(denoms);
        const minPrice = denArr.length ? denArr[0] : null;
        const maxPrice = denArr.length ? denArr[denArr.length - 1] : null;

        await VdBrand.findOneAndUpdate(
          { BrandCode },
          {
            $set: {
              BrandCode,
              BrandName: b?.BrandName || "",
              Brandtype: b?.Brandtype || "",
              Category: b?.Category || "",
              DenominationList: denoms,
              Discount: String(b?.Discount || ""),
              Description: b?.Description || "",
              Images: b?.Images || "",
              TnC: b?.TnC || "",
              ImportantInstruction: b?.ImportantInstruction || null,
              RedeemSteps: Array.isArray(b?.RedeemSteps) ? b.RedeemSteps : [],
              minPrice,
              maxPrice,
              raw: b || {},
            },
          },
          { upsert: true },
        );
        brandsUpserted++;
      }
    }

    // Fetch stores
    assertUrl(STORES, "VD_STORE_URL");
    const storesRaw = await vdPost(STORES, { BrandCode: "" }, { token }, 30000);
    const storesEncrypted =
      typeof storesRaw?.data === "string" ? storesRaw.data : "";
    const storesDec = storesEncrypted
      ? decryptVdResponseData(storesEncrypted).json
      : null;

    let storesUpserted = 0;
    if (Array.isArray(storesDec)) {
      for (const s of storesDec) {
        const StoreCode = s?.StoreCode || s?.storeCode;
        if (!StoreCode) continue;
        await VdStore.findOneAndUpdate(
          { StoreCode },
          { $set: { ...s, StoreCode, raw: s || {} } },
          { upsert: true },
        );
        storesUpserted++;
      }
    }

    return res.json({ success: true, brandsUpserted, storesUpserted });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

/* -----------------------------
 * Purchase APIs (auth required)
 * ----------------------------- */

// POST /api/giftcards/order
// Creates a DB purchase + Razorpay order.
router.post("/order", auth, async (req, res) => {
  try {
    if (!key_id || !key_secret) {
      return res
        .status(500)
        .json({ success: false, message: "Razorpay keys missing" });
    }
    if (!VD_DISTRIBUTOR_ID) {
      return res
        .status(500)
        .json({ success: false, message: "VD distributor id missing" });
    }

    const { brandCode, amount, qty } = req.body || {};
    if (!brandCode || !amount || !qty) {
      return res
        .status(400)
        .json({ success: false, message: "brandCode, amount, qty required" });
    }

    const brand = await VdBrand.findOne({ BrandCode: brandCode }).lean();
    if (!brand)
      return res
        .status(404)
        .json({ success: false, message: "Brand not found" });

    const a = Number(amount);
    const q = Number(qty);
    if (!Number.isFinite(a) || a <= 0 || !Number.isInteger(q) || q < 1) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid amount/qty" });
    }

    // Enforce denom for fixed brands
    const denoms = parseDenoms(brand.DenominationList);
    if (
      String(brand.Brandtype || "").toLowerCase() === "fixed" &&
      denoms.length &&
      !denoms.includes(a)
    ) {
      return res.status(400).json({
        success: false,
        message: "Amount must match available denomination",
      });
    }

    const total = a * q;

// discount from brand (e.g. "9.50")
const disc = Number(String(brand.Discount || "").replace(/[^0-9.]/g, "")) || 0;

// work in paise for exactness
const totalPaise = Math.round(total * 100);

// same rounding as frontend (your UI uses Math.round)
const discountPaise = disc > 0 ? Math.round((totalPaise * disc) / 100) : 0;

// payable in paise (min ₹1 safeguard)
const payablePaise = Math.max(100, totalPaise - discountPaise);
const payable = payablePaise / 100;

if (!Number.isFinite(payablePaise) || payablePaise <= 0) {
  return res.status(400).json({ success: false, message: "Invalid payable total" });
}


    const userDoc = await User.findById(req.user?.id)
      .select("name email phone address city state pincode")
      .lean();

    // Create pending purchase
    const purchase = await GiftcardPurchase.create({
      user: req.user?.id || null,
      brandCode,
      brandName: brand.BrandName || "",
      amount: a,
      qty: q,
      totalAmount: payable,
      buyer: {
        name: userDoc?.name || "",
        email: userDoc?.email || req.user?.email || "",
        mobile: userDoc?.phone || "",
        address: userDoc?.address || "",
        city: userDoc?.city || "",
        state: userDoc?.state || "",
        pincode: userDoc?.pincode || "",
      },
      status: "PENDING_PAYMENT",
    });

    const order = await razorpay.orders.create({
      amount: payablePaise,
      currency: "INR",
      receipt: `GC_${purchase._id}`,
      notes: {
        purchaseId: String(purchase._id),
        brandCode,
        qty: String(q),
        amount: String(a),
      },
    });

    purchase.razorpay = { order_id: order.id };
    await purchase.save();

    return res.json({
      success: true,
      key_id,
      order,
      purchaseId: String(purchase._id),
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// POST /api/giftcards/verify
// Verifies Razorpay signature, fulfills via VD EVC, stores vouchers.
router.post("/verify", auth, async (req, res) => {
  try {
    const {
      purchaseId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      buyer,
    } = req.body || {};

    if (
      !purchaseId ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing payment verification fields",
      });
    }

    if (!key_secret) {
      return res
        .status(500)
        .json({ success: false, message: "Razorpay secret missing" });
    }

    const purchase = await GiftcardPurchase.findById(purchaseId);
    if (!purchase)
      return res
        .status(404)
        .json({ success: false, message: "Purchase not found" });

    if (String(purchase.user || "") !== String(req.user?.id || "")) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    // idempotent
    if (purchase.status === "SUCCESS" || purchase.status === "SUCCESS_TEST") {
      return res.json({
        success: true,
        message: "Already fulfilled",
        purchaseId: String(purchase._id),
        status: purchase.status,
      });
    }

    if (
      purchase.razorpay?.order_id &&
      purchase.razorpay.order_id !== razorpay_order_id
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Order ID mismatch" });
    }

    const ok = verifyRazorpaySignature({
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
      signature: razorpay_signature,
    });
    if (!ok) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment signature" });
    }

    // Update buyer details if provided from UI checkout
    if (buyer && typeof buyer === "object") {
      purchase.buyer = { ...purchase.buyer, ...buyer };
    }

    purchase.razorpay = {
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
      signature: razorpay_signature,
    };

    // Minimal buyer validation for VD
    const buyerName = purchase.buyer?.name || "";
    const buyerEmail = purchase.buyer?.email || "";
    const buyerMobileRaw = purchase.buyer?.mobile || "";
    const buyerMobile = safeMobile(buyerMobileRaw);

    if (!buyerName || !buyerEmail || !buyerMobile) {
      return res.status(400).json({
        success: false,
        message:
          "buyer.name, buyer.email, buyer.mobile required to fulfill gift card",
      });
    }

    const { first, last } = splitName(buyerName);

    // ---------------------------
    // EXACT VD PLAIN PAYLOAD (as you demanded)
    // ---------------------------
    // helpers
    const isDebug =
      String(process.env.VD_DEBUG_PAYLOAD || "").toLowerCase() === "true";
    const allowFallback =
      String(process.env.ALLOW_FALLBACK_MOCK || "").toLowerCase() === "true";

    function randId(len = 16) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let out = "";
      for (let i = 0; i < len; i++)
        out += chars[Math.floor(Math.random() * chars.length)];
      return out;
    }

    // idempotent stable ids (so repeated verify doesn't change vd fields)
    const stableReqId =
      purchase.vdOrder?.request_ref_no ||
      purchase.reqId ||
      `CR_${purchase._id}`;
    const stableReceiptNo = purchase.vdOrder?.receiptNo || `RCPT-${randId(12)}`;
    const stableOrderId = purchase.vdOrder?.order_id || randId(16);

    // ensure +91 format like your example
    const mobile_no = buyerMobile.startsWith("+")
      ? buyerMobile
      : `+91${buyerMobile}`;

    const payloadObj = {
      order_id: stableOrderId,
      distributor_id: VD_DISTRIBUTOR_ID,
      sku_code: String(purchase.brandCode || ""),
      no_of_card: Number(purchase.qty || 1),
      amount: Number(purchase.amount || 0),
      receiptNo: stableReceiptNo,
      reqId: stableReqId,

      firstname: String(first || ""),
      lastname: String(last || ""),
      email: String(buyerEmail || ""),
      mobile_no,

      address: String(purchase.buyer?.address || "NA"),
      city: String(purchase.buyer?.city || "NA"),
      state: String(purchase.buyer?.state || "NA"),
      country: "IN",
      pincode: String(purchase.buyer?.pincode || ""),
      curr: "356",
    };

    // save stable ids once (so later retries remain identical)
    purchase.vdOrder = {
      ...(purchase.vdOrder || {}),
      order_id: stableOrderId,
      request_ref_no: stableReqId,
      receiptNo: stableReceiptNo,
    };
    await purchase.save();

    if (purchase.vdRaw && String(purchase.vdRaw.responseCode || "") === "0") {
      // already approved earlier, don't call VD again
      purchase.status = "SUCCESS";
      await purchase.save();
      return res.json({
        success: true,
        purchaseId: String(purchase._id),
        status: purchase.status,
        vdFallback: false,
      });
    }

    // ---------- VD Fulfill ----------
    let token;
    let vdOut;
    try {
      token = await getVdToken();
      vdOut = await callVdEvc({ token, payloadObj });

      // Token might expire earlier; retry once
      const msgLower = String(
        vdOut?.responseRaw?.responseMsg || vdOut?.responseRaw?.message || "",
      ).toLowerCase();
      const codeStr = String(vdOut?.responseRaw?.responseCode || "");

      if (codeStr === "1104" || msgLower.includes("expired")) {
        token = await getVdToken({ force: true });
        vdOut = await callVdEvc({ token, payloadObj });
      }
    } catch (e) {
      purchase.status = "VD_FAILED";
      purchase.vdRaw = { error: String(e?.message || e) };
      await purchase.save();

      return res.status(502).json({
        success: false,
        message: "ValueDesign fulfillment error",
        error: String(e?.message || e),
        hint: "If you want fallback testing, set ALLOW_FALLBACK_MOCK=true",
        ...(isDebug ? { debug: { vd_payload_plain: payloadObj } } : {}),
      });
    }

    // Determine success
    const raw = vdOut?.responseRaw || {};
    const vdStatus = String(raw?.status || "").toUpperCase();
    const vdCode = String(raw?.responseCode || raw?.code || "").trim();
    const vdMsg = String(raw?.responseMsg || raw?.message || "").toUpperCase();

    // VD success signals (real-world VD pattern)
    const vdOk =
      vdCode === "0" ||
      vdStatus === "SUCCESS" ||
      vdStatus === "APPROVAL" ||
      vdStatus === "APPROVED" ||
      vdMsg.includes("APPROVAL") ||
      vdMsg.includes("APPROVED") ||
      vdMsg.includes("SUCCESS");

    purchase.vdRaw = vdOut?.responseRaw || null;

    // ---------- OPTION B FALLBACK ----------
    if (!vdOk) {
      const code = String(vdOut?.responseRaw?.responseCode || "");
      const msg = String(vdOut?.responseRaw?.responseMsg || "").toLowerCase();

      const isInsufficient =
        code === "16" ||
        msg.includes("insufficient") ||
        msg.includes("insufficent") ||
        msg.includes("low balance");

      if (allowFallback && isInsufficient) {
        const qty = Math.max(1, Number(purchase.qty || 1));

        const vouchers = {
          mode: "FALLBACK_MOCK",
          provider: "ValueDesign",
          reason: "INSUFFICIENT_FUNDS",
          items: Array.from({ length: qty }).map((_, i) => ({
            code: `TEST-${String(purchase._id).slice(-6)}-${i + 1}`,
            pin: String(Math.floor(1000 + Math.random() * 9000)),
            amount: Number(purchase.amount || 0),
            currency: "INR",
            expiry: "2027-12-31",
          })),
        };

        purchase.vouchers_enc = encryptJson(vouchers);
        purchase.vouchers_masked = maskVouchers(vouchers);
        purchase.status = "SUCCESS_TEST";
        await purchase.save();

        // Email best-effort
        try {
          const to = buyerEmail;
          const subject = `Your Cashrivo Gift Card (TEST) - ${purchase.brandName}`;
          const html = buildGiftCardEmailHtml({
            brandName: purchase.brandName,
            totalAmount: purchase.totalAmount,
            orderId: purchase._id,
            vouchers,
          });

          const info = await sendMail({
            to,
            subject,
            html,
            text: "Your test gift card is ready. Please login to Cashrivo to view.",
          });

          purchase.emailDelivery = {
            sent: true,
            to,
            messageId: String(info?.messageId || ""),
            error: "",
            sentAt: new Date(),
          };
          await purchase.save();
        } catch (e) {
          purchase.emailDelivery = {
            sent: false,
            to: buyerEmail,
            messageId: "",
            error: String(e?.message || e),
            sentAt: null,
          };
          await purchase.save();
        }

        return res.json({
          success: true,
          purchaseId: String(purchase._id),
          status: purchase.status,
          vdFallback: true,
          vd: purchase.vdRaw,
          ...(isDebug ? { debug: { vd_payload_plain: payloadObj } } : {}),
        });
      }

      // No fallback → fail normally
      purchase.status = "VD_FAILED";
      await purchase.save();

      return res.status(502).json({
        success: false,
        message: "ValueDesign fulfillment failed",
        vd: vdOut?.responseRaw,
        ...(isDebug ? { debug: { vd_payload_plain: payloadObj } } : {}),
      });
    }

    // ---------- Normal SUCCESS path ----------
    const vouchers =
      extractVouchersFromDecrypted(vdOut?.decryptedJson) ||
      vdOut?.decryptedJson ||
      vdOut?.decryptedText;

    purchase.vouchers_enc = vouchers ? encryptJson(vouchers) : "";
    purchase.vouchers_masked = vouchers ? maskVouchers(vouchers) : null;
    purchase.status = "SUCCESS";
    await purchase.save();

    // Email delivery (best-effort)
    try {
      const to = buyerEmail;
      const subject = `Your Cashrivo Gift Card - ${purchase.brandName}`;
      const html = buildGiftCardEmailHtml({
        brandName: purchase.brandName,
        totalAmount: purchase.totalAmount,
        orderId: purchase._id,
        vouchers,
      });

      const info = await sendMail({
        to,
        subject,
        html,
        text: "Your gift card is ready. Please login to Cashrivo to view.",
      });

      purchase.emailDelivery = {
        sent: true,
        to,
        messageId: String(info?.messageId || ""),
        error: "",
        sentAt: new Date(),
      };
      await purchase.save();
    } catch (e) {
      purchase.emailDelivery = {
        sent: false,
        to: buyerEmail,
        messageId: "",
        error: String(e?.message || e),
        sentAt: null,
      };
      await purchase.save();
    }

    return res.json({
      success: true,
      purchaseId: String(purchase._id),
      status: purchase.status,
      vdFallback: false,
      ...(isDebug ? { debug: { vd_payload_plain: payloadObj } } : {}),
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/giftcards/my-orders
router.get("/my-orders", auth, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));

    const filter = { user: req.user?.id };
    const total = await GiftcardPurchase.countDocuments(filter);
    const items = await GiftcardPurchase.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const safeItems = items.map((o) => ({
      ...o,
      vouchers: o.vouchers_masked || null,
      vouchers_enc: undefined,
    }));

    return res.json({
      success: true,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      items: safeItems,
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/giftcards/order/:id
router.get("/order/:id", auth, async (req, res) => {
  try {
    const order = await GiftcardPurchase.findById(req.params.id).lean();
    if (!order)
      return res.status(404).json({ success: false, message: "Not found" });
    if (String(order.user || "") !== String(req.user?.id || "")) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const vouchers = decryptJson(order.vouchers_enc);
    return res.json({
      success: true,
      order: { ...order, vouchers, vouchers_enc: undefined },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
