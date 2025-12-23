// server/valuedesign/vd.client.js
import axios from "axios";
import { encryptJson, decryptToJson, decryptToString } from "./vd.crypto.js";
import { setToken, getToken as getCachedToken } from "./vd.tokenStore.js";

/**
 * Endpoints (as shared by you)
 * - Generate Token        : http://cards.vdwebapi.com/distributor/api-generatetoken/
 *   Body: {"distributor_id":""}
 *   Headers: username, password
 *
 * - Get Brand             : http://cards.vdwebapi.com/distributor/api-getbrand/
 *   Headers: token
 *   Body: {"BrandCode":""}
 *
 * - Get Store             : http://cards.vdwebapi.com/distributor/api-getstore/
 *   Headers: token
 *   Body: {"BrandCode":""}
 *
 * - Get EVC               : http://cards.vdwebapi.com/distributor/getevc/
 *   Headers: token
 *   Body: {"payload":""}  // payload = AES(base64) of RAW order JSON
 *
 * - Get EVC Status        : http://cards.vdwebapi.com/distributor/getevcstatus/
 *   Headers: token
 *   Body: {"order_id":"","request_ref_no":""}
 *
 * - Get Activated EVC     : http://cards.vdwebapi.com/distributor/getactivatedevc/
 *   Headers: token
 *   Body: {"order_id":"","request_ref_no":""}
 *
 * - Wallet Balance        : http://cards.vdwebapi.com/distributor/getwalletbalance/
 *   Headers: token
 *   Body: {"distributor_id":""}
 *
 * PDF notes:
 * - Token valid 7 days; required for calls
 * - Many responses contain encrypted "data" needing decryption. :contentReference[oaicite:1]{index=1}
 */

function cfg() {
  const required = [
    "VD_DISTRIBUTOR_ID",
    "VD_USERNAME",
    "VD_PASSWORD",
    "VD_TOKEN_URL",
    "VD_BRAND_URL",
    "VD_STORE_URL",
    "VD_EVC_URL",
    "VD_EVC_STATUS_URL",
    "VD_EVC_ACTIVATED_URL",
    "VD_WALLET_URL",
  ];
  for (const k of required) {
    if (!process.env[k]) throw new Error(`${k} missing in env`);
  }
  return {
    DISTRIBUTOR_ID: process.env.VD_DISTRIBUTOR_ID,
    USERNAME: process.env.VD_USERNAME,
    PASSWORD: process.env.VD_PASSWORD,

    TOKEN_URL: process.env.VD_TOKEN_URL,
    BRAND_URL: process.env.VD_BRAND_URL,
    STORE_URL: process.env.VD_STORE_URL,
    EVC_URL: process.env.VD_EVC_URL,
    EVC_STATUS_URL: process.env.VD_EVC_STATUS_URL,
    EVC_ACTIVATED_URL: process.env.VD_EVC_ACTIVATED_URL,
    WALLET_URL: process.env.VD_WALLET_URL,
  };
}

function tokenHeaders(token) {
  return { headers: { token } };
}

function normalizeDecryptedData(respData) {
  // VD often returns: { resultCode, ..., data: "<base64>" }
  // Decrypt if "data" exists and looks like base64.
  if (respData && typeof respData === "object" && respData.data) {
    try {
      return { ...respData, data: decryptToJson(respData.data), _dataDecrypted: true };
    } catch {
      // Sometimes decrypted content is not JSON (rare)
      try {
        return { ...respData, data: decryptToString(respData.data), _dataDecrypted: true };
      } catch {
        return { ...respData, _dataDecrypted: false };
      }
    }
  }
  return respData;
}

/** Token */
export async function generateToken() {
  const C = cfg();

  const r = await axios.post(
    C.TOKEN_URL,
    { distributor_id: C.DISTRIBUTOR_ID },
    { headers: { username: C.USERNAME, password: C.PASSWORD } }
  );

  // Token may be plain OR encrypted depending on VD environment.
  // We try common fields first.
  const raw = r.data;

  let token = raw?.token || raw?.data || raw?.Token || raw?.access_token || null;

  // If token looks long base64-ish and decryption works, use decrypted.
  if (token && typeof token === "string") {
    const maybe = token.trim();
    // Attempt decrypt; fallback to plain
    try {
      const decStr = decryptToString(maybe);
      // Some VD docs show decrypted token is a long alnum string (not JSON). :contentReference[oaicite:2]{index=2}
      if (decStr && decStr.length >= 16) token = decStr.replace(/[\r\n"]/g, "").trim();
    } catch {
      // keep plain
    }
  }

  if (!token) throw new Error(`Token not found in response: ${JSON.stringify(raw)}`);

  setToken(token);
  return { token, raw };
}

export async function getToken() {
  const t = getCachedToken();
  if (t) return t;
  const out = await generateToken();
  return out.token;
}

/** Brands */
export async function getBrand(BrandCode = "") {
  const C = cfg();
  const token = await getToken();

  const r = await axios.post(C.BRAND_URL, { BrandCode }, tokenHeaders(token));
  return normalizeDecryptedData(r.data);
}

/** Stores */
export async function getStore(BrandCode = "") {
  const C = cfg();
  const token = await getToken();

  const r = await axios.post(C.STORE_URL, { BrandCode }, tokenHeaders(token));
  return normalizeDecryptedData(r.data);
}

/**
 * EVC
 * Input: rawOrderJson = full raw JSON (order_id, distributor_id, sku_code, no_of_card, amount, receiptNo, reqId, user fields...)
 * Output: decrypted "data" with cardNo/cardPin/etc when approval. :contentReference[oaicite:3]{index=3}
 */
export async function getEvc(rawOrderJson) {
  const C = cfg();
  const token = await getToken();

  // Ensure distributor_id default = your distributor
  const payloadObj = {
    ...rawOrderJson,
    distributor_id: rawOrderJson?.distributor_id || C.DISTRIBUTOR_ID,
  };

  const payload = encryptJson(payloadObj);

  const r = await axios.post(C.EVC_URL, { payload }, tokenHeaders(token));
  return normalizeDecryptedData(r.data);
}

/** EVC Status */
export async function getEvcStatus(order_id, request_ref_no) {
  const C = cfg();
  const token = await getToken();

  const r = await axios.post(C.EVC_STATUS_URL, { order_id, request_ref_no }, tokenHeaders(token));
  return r.data;
}

/** Activated EVC */
export async function getActivatedEvc(order_id, request_ref_no) {
  const C = cfg();
  const token = await getToken();

  const r = await axios.post(C.EVC_ACTIVATED_URL, { order_id, request_ref_no }, tokenHeaders(token));
  return normalizeDecryptedData(r.data);
}

/** Wallet Balance */
export async function getWalletBalance() {
  const C = cfg();
  const token = await getToken();

  const r = await axios.post(C.WALLET_URL, { distributor_id: C.DISTRIBUTOR_ID }, tokenHeaders(token));
  return normalizeDecryptedData(r.data);
}
