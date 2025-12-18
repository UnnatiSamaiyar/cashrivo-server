// routes/agodaPaginated.js
const express = require("express");
const axios = require("axios");
const cityData = require("../data/city_ids.json");
const cron = require("node-cron");
const AgodaHotel = require("../models/AgodaHotel"); // <-- now uses ONLY Agoda DB connection
const { ensureAgodaConnected } = require("../db/agodaDb"); // <-- ensure Agoda DB is connected

const router = express.Router();

const AGODA_ENDPOINT =
  "http://affiliateapi7643.agoda.com/affiliateservice/lt_v1";
const SITE_ID = process.env.AGODA_SITE_ID || "1953959";
const API_KEY =
  process.env.AGODA_API_KEY || "a1b3fe31-8469-46df-8877-364e9677aa80";

// CONFIG
const DEFAULT_CONCURRENCY = 10;
const REQUEST_TIMEOUT = 15000;
const MAX_RETRIES = 3;
const BACKOFF_BASE = 300;

// build minimal body but ALWAYS include required dates
function buildBodyWithDates(cityId, checkInDate, checkOutDate) {
  return {
    siteId: SITE_ID,
    apiKey: API_KEY,
    criteria: {
      cityId: Number(cityId),
      checkInDate,
      checkOutDate,
    },
  };
}

// improved retry + fallback logging
async function doRequestWithRetry(body, headers, maxRetries = MAX_RETRIES) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const resp = await axios.post(AGODA_ENDPOINT, body, {
        headers,
        timeout: REQUEST_TIMEOUT,
      });
      return { ok: true, data: resp.data };
    } catch (err) {
      attempt++;
      const status = err.response?.status;
      const respData = err.response?.data;
      console.warn("agoda-request-error", {
        status,
        cityId: body?.criteria?.cityId,
        attempt,
        respData,
      });

      // if 4xx non-429 -> don't keep hammering; return the response data for inspection
      if (status && status >= 400 && status < 500 && status !== 429) {
        return {
          ok: false,
          error: err.message || "4xx error",
          status,
          respData,
        };
      }

      if (attempt > maxRetries) {
        return {
          ok: false,
          error: err.message || "failed after retries",
          status: status || null,
          respData,
        };
      }

      const wait = BACKOFF_BASE * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  return { ok: false, error: "unhandled failure" };
}

// simple promise pool
async function promisePool(tasks, concurrency) {
  const results = [];
  let i = 0;
  const runners = new Array(Math.min(concurrency, tasks.length))
    .fill(null)
    .map(async () => {
      while (i < tasks.length) {
        const idx = i++;
        try {
          results[idx] = await tasks[idx]();
        } catch (e) {
          results[idx] = { error: e.message || String(e) };
        }
      }
    });
  await Promise.all(runners);
  return results;
}

/**
 * Helper: processPage
 * Reuses the same logic as the route to fetch & return results for a single page.
 * Returns an object identical to what route would include in `data`.
 */
async function processPage({
  page = 1,
  perPage = 50,
  concurrency = DEFAULT_CONCURRENCY,
  checkInDate,
  checkOutDate,
}) {
  // bounds
  const totalCities = cityData.city_ids.length;
  const totalPages = Math.ceil(totalCities / perPage);
  if (page > totalPages) {
    return { error: "page out of range", totalPages };
  }

  const start = (page - 1) * perPage;
  const end = Math.min(start + perPage, totalCities);
  const pageCityIds = cityData.city_ids.slice(start, end);

  const headers = {
    "Content-Type": "application/json",
    Authorization: `${SITE_ID}:${API_KEY}`,
  };

  // tasks for this page
  const tasks = pageCityIds.map((cityId) => async () => {
    const body = buildBodyWithDates(cityId, checkInDate, checkOutDate);
    const result = await doRequestWithRetry(body, headers);

    if (result.ok) {
      return { cityId, hotels: result.data?.results || result.data };
    } else {
      return {
        cityId,
        error: result.error,
        status: result.status || null,
        details: result.respData || null,
      };
    }
  });

  const results = await promisePool(tasks, concurrency);

  return {
    totalCities,
    page,
    perPage,
    totalPages,
    concurrency,
    data: results,
  };
}

/**
 * Helper: savePageToDb
 * Accepts pageData = array of { cityId, hotels } and performs chunked bulkWrite upserts.
 * Returns { ok: true, operations: N } or throws.
 */
async function savePageToDb(pageData) {
  // Ensure Agoda DB connection is ready (MONGO_AGODA_DB_URI only)
  await ensureAgodaConnected();

  const bulkOps = [];

  for (const item of pageData) {
    if (!item.hotels || !Array.isArray(item.hotels)) continue;
    const cityId = Number(item.cityId);
    for (const h of item.hotels) {
      // map fields defensively
      const hotelId = Number(h.hotelId || h.id || 0);
      const updateDoc = {
        cityId,
        hotelId,
        hotelName: h.hotelName,
        starRating: h.starRating,
        reviewScore: h.reviewScore,
        reviewCount: h.reviewCount,
        currency: h.currency,
        dailyRate: h.dailyRate,
        crossedOutRate: h.crossedOutRate,
        discountPercentage: h.discountPercentage,
        imageURL: h.imageURL,
        landingURL: h.landingURL,
        includeBreakfast: h.includeBreakfast,
        freeWifi: h.freeWifi,
        latitude: h.latitude,
        longitude: h.longitude,
        raw: h,
        lastFetchedAt: new Date(),
      };

      bulkOps.push({
        updateOne: {
          filter: { cityId, hotelId },
          update: { $set: updateDoc, $setOnInsert: { createdAt: new Date() } },
          upsert: true,
        },
      });
    }
  }

  if (!bulkOps.length) return { ok: true, operations: 0 };

  // chunk bulkOps to avoid huge single bulkWrite
  const CHUNK_SIZE = 1000;
  let operations = 0;
  for (let i = 0; i < bulkOps.length; i += CHUNK_SIZE) {
    const chunk = bulkOps.slice(i, i + CHUNK_SIZE);
    await AgodaHotel.bulkWrite(chunk, { ordered: false });
    operations += chunk.length;
  }
  return { ok: true, operations };
}

/**
 * GET /agoda/paginated
 * query:
 *   page (1-based, default 1)
 *   perPage (default 50)
 *   concurrency (optional, default 10)
 *   checkInDate, checkOutDate (optional: format YYYY-MM-DD)
 */
router.get("/agoda/paginated", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = Math.max(1, Number(req.query.perPage) || 50);
    const concurrency = Math.max(
      1,
      Number(req.query.concurrency) || DEFAULT_CONCURRENCY
    );

    // default dates: today and tomorrow
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);

    const checkInDate = req.query.checkInDate || today;
    const checkOutDate = req.query.checkOutDate || tomorrow;

    const pageResult = await processPage({
      page,
      perPage,
      concurrency,
      checkInDate,
      checkOutDate,
    });

    // pageResult already contains totalCities, page, perPage, totalPages, concurrency, data
    return res.json({
      totalCities: pageResult.totalCities,
      page: pageResult.page,
      perPage: pageResult.perPage,
      totalPages: pageResult.totalPages,
      concurrency: pageResult.concurrency,
      checkInDate,
      checkOutDate,
      data: pageResult.data,
    });
  } catch (err) {
    console.error("paginated-error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ===============================
// MANUAL TRIGGER: hit and fetch page(s) and save to DB
// ===============================
router.get("/agoda/manual-sync", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = Math.max(1, Number(req.query.perPage) || 50);
    const concurrency = Math.max(
      1,
      Number(req.query.concurrency) || DEFAULT_CONCURRENCY
    );

    // default check-in / out
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);

    console.log(
      `[ManualSync] Triggered → page=${page}, perPage=${perPage}, concurrency=${concurrency}`
    );

    const result = await processPage({
      page,
      perPage,
      concurrency,
      checkInDate: today,
      checkOutDate: tomorrow,
    });

    let saveSummary = { ok: true, operations: 0 };
    try {
      if (result && result.data) {
        saveSummary = await savePageToDb(result.data);
      }
    } catch (saveErr) {
      console.error("[ManualSync Save Error]:", saveErr);
      saveSummary = { ok: false, error: saveErr.message || String(saveErr) };
    }

    return res.json({
      ok: true,
      message: "Manual Agoda sync complete",
      totalCities: result.totalCities,
      page: result.page,
      perPage: result.perPage,
      totalPages: result.totalPages,
      concurrency: result.concurrency,
      saved: saveSummary,
      data: result.data,
    });
  } catch (err) {
    console.error("[ManualSync Error]:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /agoda/db-hotels
// Query params:
//  q, cityId, hotelId, minPrice, maxPrice, minStar, minScore, freeWifi
//  page (1-based), perPage, sortBy (price|score|rating|newest), sortDir (asc|desc)
// Example: /agoda/db-hotels?cityId=11361&page=1&perPage=20&minPrice=100&sortBy=price&sortDir=asc
router.get("/agoda/db-hotels", async (req, res) => {
  try {
    // Ensure Agoda DB connection is ready (MONGO_AGODA_DB_URI only)
    await ensureAgodaConnected();

    const {
      q,
      cityId,
      hotelId,
      minPrice,
      maxPrice,
      minStar,
      minScore,
      freeWifi,
      lat,
      lng,
      radius,
      page = 1,
      perPage = 20,
      sortBy = "newest",
      sortDir = "desc",
      fields,
    } = req.query;

    const p = Math.max(1, Number(page));
    const limit = Math.min(1000, Math.max(1, Number(perPage))); // cap perPage
    const skip = (p - 1) * limit;

    // Build filter
    const filter = {};
    if (cityId) filter.cityId = Number(cityId);
    if (hotelId) filter.hotelId = Number(hotelId);
    if (minPrice)
      filter.dailyRate = {
        ...(filter.dailyRate || {}),
        $gte: Number(minPrice),
      };
    if (maxPrice)
      filter.dailyRate = {
        ...(filter.dailyRate || {}),
        $lte: Number(maxPrice),
      };
    if (minStar) filter.starRating = { $gte: Number(minStar) };
    if (minScore) filter.reviewScore = { $gte: Number(minScore) };
    if (typeof freeWifi !== "undefined") {
      // accept "true"/"false"
      filter.freeWifi = String(freeWifi) === "true";
    }
    if (q) {
      // simple case-insensitive substring search on hotelName
      filter.hotelName = { $regex: q, $options: "i" };
    }
    // ---------------- GEO FILTER (TEMP / WORKING) ----------------
    if (lat && lng && radius) {
      const latNum = Number(lat);
      const lngNum = Number(lng);
      const rKm = Number(radius);

      // approx: 1 degree ~ 111 km
      const delta = rKm / 111;

      filter.latitude = {
        $gte: latNum - delta,
        $lte: latNum + delta,
      };

      filter.longitude = {
        $gte: lngNum - delta,
        $lte: lngNum + delta,
      };
    }

    // Projection
    const projection = {};
    if (fields) {
      fields.split(",").forEach((f) => {
        projection[f.trim()] = 1;
      });
    }

    // Sorting
    const sortMap = {
      price: { dailyRate: sortDir === "asc" ? 1 : -1 },
      score: { reviewScore: sortDir === "asc" ? 1 : -1 },
      rating: { starRating: sortDir === "asc" ? 1 : -1 },
      newest: { lastFetchedAt: sortDir === "asc" ? 1 : -1 },
    };
    const sort = sortMap[sortBy] || sortMap.newest;

    // Execute queries in parallel
    const [total, data] = await Promise.all([
      AgodaHotel.countDocuments(filter),
      AgodaHotel.find(filter, projection)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return res.json({
      ok: true,
      total,
      page: p,
      perPage: limit,
      totalPages,
      data,
    });
  } catch (err) {
    console.error("db-hotels-error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// GET single hotel by city+hotel
// /agoda/db-hotel?cityId=11361&hotelId=3216617
router.get("/agoda/db-hotel", async (req, res) => {
  try {
    // Ensure Agoda DB connection is ready (MONGO_AGODA_DB_URI only)
    await ensureAgodaConnected();

    const { cityId, hotelId } = req.query;
    if (!cityId || !hotelId)
      return res
        .status(400)
        .json({ ok: false, error: "cityId and hotelId required" });

    const doc = await AgodaHotel.findOne({
      cityId: Number(cityId),
      hotelId: Number(hotelId),
    }).lean();
    if (!doc) return res.status(404).json({ ok: false, error: "not found" });
    return res.json({ ok: true, data: doc });
  } catch (err) {
    console.error("db-hotel-error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;

/* =========================
   CRON: run automatic sync (LOW SERVER USAGE)
   =========================
   Goal:
   - Run once every 2 days (48 hours)
   - Keep CPU/RAM low
   - Avoid overlapping runs
   - Process pages sequentially with low concurrency
*/

const CRON_ENABLED = process.env.AGODA_CRON_ENABLED !== "false"; // default true

// Keep these conservative for low server usage:
const CRON_PER_PAGE = Number(process.env.AGODA_CRON_PER_PAGE) || 100; // lower = less memory spike
const CRON_CONCURRENCY = Number(process.env.AGODA_CRON_CONCURRENCY) || 2; // low CPU/network load
const CRON_PAUSE_BETWEEN_PAGES_MS =
  Number(process.env.AGODA_CRON_PAUSE_MS) || 1500; // bigger pause = less load

// Optional: hard stop after X minutes (prevents runaway jobs)
const CRON_MAX_RUNTIME_MIN =
  Number(process.env.AGODA_CRON_MAX_RUNTIME_MIN) || 180; // 3 hours default

// ✅ Simple in-memory lock to prevent overlapping cron runs
let AGODA_CRON_IS_RUNNING = false;

// ✅ Every 2 days at 03:30 AM Asia/Kolkata (low traffic)
// Cron format: minute hour day-of-month month day-of-week
// "30 3 */2 * *" = 03:30 on every 2nd day of month
// NOTE: This is "every 2 days" by date (1,3,5...) not strict 48h after last run.
// For most use-cases, this is perfectly fine and low overhead.
const CRON_EXPR = process.env.AGODA_CRON_EXPR || "30 3 */2 * *";

if (CRON_ENABLED) {
  cron.schedule(
    CRON_EXPR,
    async () => {
      if (AGODA_CRON_IS_RUNNING) {
        console.log("[AgodaCron] skipped (already running)");
        return;
      }

      AGODA_CRON_IS_RUNNING = true;

      const startedAt = Date.now();
      const deadlineMs = CRON_MAX_RUNTIME_MIN * 60 * 1000;

      console.log(
        `[AgodaCron] starting sync @ ${new Date().toISOString()} | expr=${CRON_EXPR} | perPage=${CRON_PER_PAGE} | concurrency=${CRON_CONCURRENCY}`
      );

      try {
        const totalCities = cityData.city_ids.length;
        const totalPages = Math.ceil(totalCities / CRON_PER_PAGE);

        console.log(
          `[AgodaCron] totalCities=${totalCities}, totalPages=${totalPages}, perPage=${CRON_PER_PAGE}, concurrency=${CRON_CONCURRENCY}, pauseMs=${CRON_PAUSE_BETWEEN_PAGES_MS}`
        );

        // default dates (today/tomorrow)
        const today = new Date().toISOString().slice(0, 10);
        const tomorrow = new Date(Date.now() + 24 * 3600 * 1000)
          .toISOString()
          .slice(0, 10);

        for (let p = 1; p <= totalPages; p++) {
          // ✅ Hard runtime cutoff (low server risk)
          if (Date.now() - startedAt > deadlineMs) {
            console.warn(
              `[AgodaCron] stopped due to max runtime limit (${CRON_MAX_RUNTIME_MIN} min). lastPage=${
                p - 1
              }/${totalPages}`
            );
            break;
          }

          const startTs = Date.now();
          console.log(`[AgodaCron] processing page ${p}/${totalPages} ...`);

          try {
            const r = await processPage({
              page: p,
              perPage: CRON_PER_PAGE,
              concurrency: CRON_CONCURRENCY,
              checkInDate: today,
              checkOutDate: tomorrow,
            });

            const okCount = (r.data || []).filter((d) => d.hotels).length;
            const errCount = (r.data || []).filter((d) => d.error).length;

            console.log(
              `[AgodaCron] page ${p} fetched — ok=${okCount}, errors=${errCount}, timeMs=${
                Date.now() - startTs
              }`
            );

            // ✅ Save to DB (already chunked in savePageToDb)
            try {
              const saveRes = await savePageToDb(r.data || []);
              console.log(
                `[AgodaCron] page ${p} saved — ops=${saveRes.operations || 0}`
              );
            } catch (saveErr) {
              console.error(`[AgodaCron] save page ${p} failed:`, saveErr);
            }
          } catch (pageErr) {
            console.error(`[AgodaCron] page ${p} failed:`, pageErr);
          }

          // polite pause between pages (reduces CPU/network spikes)
          await new Promise((r) => setTimeout(r, CRON_PAUSE_BETWEEN_PAGES_MS));
        }

        console.log(
          `[AgodaCron] finished @ ${new Date().toISOString()} | totalTimeMs=${
            Date.now() - startedAt
          }`
        );
      } catch (e) {
        console.error("[AgodaCron] unexpected error:", e);
      } finally {
        AGODA_CRON_IS_RUNNING = false;
      }
    },
    {
      scheduled: true,
      timezone: "Asia/Kolkata",
    }
  );

  console.log(
    "[AgodaCron] scheduled — enabled=true | expr=",
    CRON_EXPR,
    "| AGODA_CRON_ENABLED=",
    CRON_ENABLED
  );
} else {
  console.log("[AgodaCron] disabled via AGODA_CRON_ENABLED=false");
}
