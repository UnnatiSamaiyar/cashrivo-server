import SeoSettings from "../models/SeoSettings.js";

const SINGLETON_ID = "global-seo-settings";

function normalizeKeywords(input) {
  // Accept: array OR comma-separated string
  if (Array.isArray(input)) {
    return input
      .map((k) => String(k || "").trim())
      .filter(Boolean)
      .slice(0, 200);
  }
  if (typeof input === "string") {
    return input
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 200);
  }
  return [];
}

// Public (client) — safe fields only
export async function getPublicSeo(req, res) {
  const doc =
    (await SeoSettings.findById(SINGLETON_ID).lean()) ||
    (await SeoSettings.create({ _id: SINGLETON_ID }));

  res.json({
    ok: true,
    seo: {
      siteName: doc.siteName || "",
      defaultTitle: doc.defaultTitle || "",
      defaultDescription: doc.defaultDescription || "",
      keywords: doc.keywords || [],
      ogImage: doc.ogImage || "",
      ogType: doc.ogType || "website",
      twitterCard: doc.twitterCard || "summary_large_image",
      twitterSite: doc.twitterSite || "",
      robots: doc.robots || "index,follow",
      canonicalBase: doc.canonicalBase || "",
      updatedAt: doc.updatedAt,
    },
  });
}

// Admin read (same as public for now)
export async function getAdminSeo(req, res) {
  return getPublicSeo(req, res);
}

// Admin update — upsert singleton
export async function upsertSeo(req, res) {
  const payload = req.body || {};

  const update = {
    siteName: String(payload.siteName || ""),
    defaultTitle: String(payload.defaultTitle || ""),
    defaultDescription: String(payload.defaultDescription || ""),
    keywords: normalizeKeywords(payload.keywords),
    ogImage: String(payload.ogImage || ""),
    ogType: String(payload.ogType || "website"),
    twitterCard: String(payload.twitterCard || "summary_large_image"),
    twitterSite: String(payload.twitterSite || ""),
    robots: String(payload.robots || "index,follow"),
    canonicalBase: String(payload.canonicalBase || ""),
  };

  const doc = await SeoSettings.findByIdAndUpdate(
    SINGLETON_ID,
    { $set: update, $setOnInsert: { _id: SINGLETON_ID } },
    { new: true, upsert: true }
  ).lean();

  res.json({ ok: true, seo: doc });
}
