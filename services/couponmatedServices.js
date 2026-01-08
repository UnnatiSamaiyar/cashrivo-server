const axios = require("axios");
const https = require("https");
const Coupon = require("../models/CouponMated");

const BASE_URL = process.env.COUPOMATED_BASE_URL || "https://api.coupomated.com";
const API_KEY = process.env.COUPOMATED_API_KEY;

if (!API_KEY) throw new Error("Missing COUPOMATED_API_KEY in environment");

// Keep-alive agent (helps on big downloads)
const httpsAgent = new https.Agent({ keepAlive: true });

async function fetchCoupomated(path) {
  const url = `${BASE_URL}${path}${path.includes("?") ? "&" : "?"}apikey=${encodeURIComponent(API_KEY)}`;

  // simple retry with backoff
  const maxRetries = 3;
  let lastErr;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await axios.get(url, {
        timeout: 120_000,
        httpsAgent,
        headers: { Accept: "application/json" },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        validateStatus: (s) => s >= 200 && s < 300,
      });

      if (!Array.isArray(res.data)) {
        throw new Error(`Unexpected response from Coupomated at ${path}: expected array`);
      }
      return res.data;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }

  const msg =
    lastErr?.response?.data
      ? `Coupomated error: ${JSON.stringify(lastErr.response.data)}`
      : lastErr?.message || "Request failed";

  throw new Error(msg);
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function upsertCoupons(items, syncType) {
  if (!Array.isArray(items) || items.length === 0) {
    return { matched: 0, upserted: 0, modified: 0, total: 0, batches: 0 };
  }

  const now = new Date();
  const BATCH_SIZE = 500;
  const batches = chunkArray(items, BATCH_SIZE);

  let matched = 0;
  let modified = 0;
  let upserted = 0;
  let total = 0;

  for (const batch of batches) {
    const ops = batch
      .map((item) => {
        const doc = Coupon.fromCoupomated(item);
        if (!doc.providerCouponId) return null;

        return {
          updateOne: {
            filter: { providerCouponId: doc.providerCouponId },
            update: {
              $set: {
                ...doc,
                lastSyncedAt: now,
                lastSyncType: syncType,
              },
            },
            upsert: true,
          },
        };
      })
      .filter(Boolean);

    if (!ops.length) continue;

    const result = await Coupon.bulkWrite(ops, { ordered: false });

    matched += result.matchedCount || 0;
    modified += result.modifiedCount || 0;
    upserted += result.upsertedCount || 0;
    total += ops.length;
  }

  return { matched, modified, upserted, total, batches: batches.length };
}

async function syncAll() {
  const items = await fetchCoupomated("/coupons/all");
  const stats = await upsertCoupons(items, "all");
  return { type: "all", fetched: items.length, ...stats };
}

async function syncNew() {
  const items = await fetchCoupomated("/coupons/new");
  const stats = await upsertCoupons(items, "new");
  return { type: "new", fetched: items.length, ...stats };
}

async function syncUpdated() {
  const items = await fetchCoupomated("/coupons/updated");
  const stats = await upsertCoupons(items, "updated");
  return { type: "updated", fetched: items.length, ...stats };
}

module.exports = { syncAll, syncNew, syncUpdated };
