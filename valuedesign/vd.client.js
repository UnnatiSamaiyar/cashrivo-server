// server/valuedesign/vd.client.js
const axios = require("axios");
const { encryptJson, decryptToJson, decryptToString } = require("./vd.crypto");
const { setToken, getToken: getCachedToken } = require("./vd.tokenStore");

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
  for (const k of required) if (!process.env[k]) throw new Error(`${k} missing in env`);

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

const tokenHeaders = (token) => ({ headers: { token } });

function normalizeDecryptedData(respData) {
  if (respData && typeof respData === "object" && respData.data) {
    try {
      return { ...respData, data: decryptToJson(respData.data), _dataDecrypted: true };
    } catch {
      try {
        return { ...respData, data: decryptToString(respData.data), _dataDecrypted: true };
      } catch {
        return { ...respData, _dataDecrypted: false };
      }
    }
  }
  return respData;
}

exports.generateToken = async () => {
  const C = cfg();

  const r = await axios.post(
    C.TOKEN_URL,
    { distributor_id: C.DISTRIBUTOR_ID },
    { headers: { username: C.USERNAME, password: C.PASSWORD } }
  );

  const raw = r.data;
  let token = raw?.token || raw?.data || raw?.Token || raw?.access_token || null;

  if (token && typeof token === "string") {
    try {
      const decStr = decryptToString(token.trim());
      if (decStr && decStr.length >= 16) token = decStr.replace(/[\r\n"]/g, "").trim();
    } catch {}
  }

  if (!token) throw new Error(`Token not found in response: ${JSON.stringify(raw)}`);

  setToken(token);
  return { token, raw };
};

exports.getToken = async () => {
  const t = getCachedToken();
  if (t) return t;
  const out = await exports.generateToken();
  return out.token;
};

exports.getBrand = async (BrandCode = "") => {
  const C = cfg();
  const token = await exports.getToken();
  const r = await axios.post(C.BRAND_URL, { BrandCode }, tokenHeaders(token));
  return normalizeDecryptedData(r.data);
};

exports.getStore = async (BrandCode = "") => {
  const C = cfg();
  const token = await exports.getToken();
  const r = await axios.post(C.STORE_URL, { BrandCode }, tokenHeaders(token));
  return normalizeDecryptedData(r.data);
};

exports.getEvc = async (rawOrderJson) => {
  const C = cfg();
  const token = await exports.getToken();

  const payloadObj = { ...rawOrderJson, distributor_id: rawOrderJson?.distributor_id || C.DISTRIBUTOR_ID };
  const payload = encryptJson(payloadObj);

  const r = await axios.post(C.EVC_URL, { payload }, tokenHeaders(token));
  return normalizeDecryptedData(r.data);
};

exports.getEvcStatus = async (order_id, request_ref_no) => {
  const C = cfg();
  const token = await exports.getToken();
  const r = await axios.post(C.EVC_STATUS_URL, { order_id, request_ref_no }, tokenHeaders(token));
  return r.data;
};

exports.getActivatedEvc = async (order_id, request_ref_no) => {
  const C = cfg();
  const token = await exports.getToken();
  const r = await axios.post(C.EVC_ACTIVATED_URL, { order_id, request_ref_no }, tokenHeaders(token));
  return normalizeDecryptedData(r.data);
};

exports.getWalletBalance = async () => {
  const C = cfg();
  const token = await exports.getToken();
  const r = await axios.post(C.WALLET_URL, { distributor_id: C.DISTRIBUTOR_ID }, tokenHeaders(token));
  return normalizeDecryptedData(r.data);
};
