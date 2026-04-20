"use strict";

const express = require("express");

// Models (keep this list small + high-signal; add more later if needed)
const Blog = require("../models/Blogs");
const Coupon = require("../models/Coupon");
const LmdOffer = require("../models/LmdOffers");
const Banner = require("../models/bannerModel");
const VdBrand = require("../models/VdBrand");
// let AmazonBanner;
// try {
//   AmazonBanner = require("../models/AmazonBanner");
// } catch (_) {
//   AmazonBanner = null;
// }

const router = express.Router();

function clampInt(v, min, max, fallback) {
  const n = parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function safeRegex(q) {
  // escape regex special chars to avoid ReDoS patterns
  return String(q || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeItem({
  type,
  title,
  description,
  route,
  source,
  score,
  brandCode,
}) {
  if (!title || !route) return null;
  return {
    type,
    title,
    description: description || "",
    route,
    source: source || undefined,
    score: typeof score === "number" ? score : undefined,
    brandCode: brandCode ? String(brandCode) : undefined,
  };
}

/**
 * GET /api/search?q=...&limit=...
 * Returns: { ok:true, q, items: [{type,title,description,route,source?}] }
 *
 * IMPORTANT:
 * - Keep routes internal (start with "/") so SPA navigation works.
 * - This endpoint is intentionally read-only and public.
 */
router.get("/search", async (req, res) => {
  try {
    const qRaw = String(req.query.q || "").trim();
    const q = qRaw.slice(0, 80);
    const limit = clampInt(req.query.limit, 1, 25, 12);

    if (!q || q.length < 2) {
      return res.json({ ok: true, q, items: [] });
    }

    const rx = new RegExp(safeRegex(q), "i");

    // per-source caps (so one collection doesn't dominate)
    const per = {
      blogs: Math.min(6, limit),
      coupons: Math.min(8, limit),
      lmdOffers: Math.min(10, limit),
      banners: Math.min(4, limit),
      giftcards: Math.min(8, limit),
    };

    const queries = [];

    // Blogs
    queries.push(
      Blog.find({
        $or: [
          { title: rx },
          { description: rx },
          { category: rx },
          { tags: rx },
          { content: rx },
        ],
      })
        .sort({ createdAt: -1 })
        .limit(per.blogs)
        .select("title slug description category tags")
        .lean()
        .then((rows) =>
          rows
            .map((b) =>
              makeItem({
                type: "blog",
                title: b.title,
                description:
                  b.description ||
                  (Array.isArray(b.tags) && b.tags.length
                    ? `Tags: ${b.tags.slice(0, 6).join(", ")}`
                    : b.category
                      ? `Category: ${b.category}`
                      : ""),
                route: b.slug ? `/blog/${encodeURIComponent(b.slug)}` : "",
                source: "Blogs",
              }),
            )
            .filter(Boolean),
        ),
    );

    // Exclusive Deals (primary dataset used by /exclusive-deals page)
    queries.push(
      LmdOffer.find({
        $or: [
          { store: rx },
          { title: rx },
          { long_offer: rx },
          { description: rx },
          { categories: rx },
          { code: rx },
          { offer: rx },
          { offer_value: rx },
        ],
      })
        .sort({ featured: -1, createdAt: -1, updatedAt: -1 })
        .limit(per.lmdOffers)
        .select(
          "_id store title long_offer description categories code offer offer_value type",
        )
        .lean()
        .then((rows) =>
          rows
            .map((c) => {
              const title = c.long_offer || c.title || c.store || "Deal";
              const store = String(c.store || "").trim();
              const description =
                c.description ||
                (store && Array.isArray(c.categories) && c.categories.length
                  ? `${store} • ${c.categories[0]}`
                  : store ||
                    (Array.isArray(c.categories) && c.categories[0]) ||
                    c.offer ||
                    c.offer_value ||
                    "");

              const qLower = q.toLowerCase();
              const hay = [
                title,
                c.title,
                store,
                description,
                c.offer,
                c.offer_value,
                c.code,
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
              let score = 0;
              if (
                String(title || "")
                  .toLowerCase()
                  .startsWith(qLower)
              )
                score += 250;
              if (
                String(store || "")
                  .toLowerCase()
                  .startsWith(qLower)
              )
                score += 220;
              if (hay.includes(qLower)) score += 120;

              return makeItem({
                type: "deal",
                title,
                description,
                route: `/exclusive-deals?deal=${encodeURIComponent(String(c._id))}`,
                source: "LMD Offers",
                score,
              });
            })
            .filter(Boolean),
        ),
    );

    // Legacy coupon search fallback
    queries.push(
      Coupon.find({
        $or: [
          { couponName: rx },
          { storeName: rx },
          { category: rx },
          { description: rx },
          { tagline: rx },
          { code: rx },
        ],
      })
        .sort({ verifiedOn: -1, createdAt: -1 })
        .limit(Math.min(4, per.coupons))
        .select("couponName storeName category tagline description")
        .lean()
        .then((rows) =>
          rows
            .map((c) =>
              makeItem({
                type: "deal",
                title: c.couponName || c.storeName || "Deal",
                description:
                  c.tagline ||
                  c.description ||
                  (c.storeName && c.category
                    ? `${c.storeName} • ${c.category}`
                    : c.storeName || c.category || ""),
                route: `/exclusive-deals?search=${encodeURIComponent(String(c.storeName || c.couponName || "").trim())}`,
                source: "Coupons",
              }),
            )
            .filter(Boolean),
        ),
    );

    // Site Banners (admin-managed)
    queries.push(
      Banner.find({
        $or: [{ title: rx }, { altText: rx }, { code: rx }],
      })
        .sort({ order: 1 })
        .limit(per.banners)
        .select("title altText link code")
        .lean()
        .then((rows) =>
          rows
            .map((b) => {
              const link = String(b.link || "");
              const internal = link.startsWith("/") ? link : "";
              return makeItem({
                type: "banner",
                title: b.title || b.altText || "Banner",
                description: b.altText || b.code || "",
                route: internal,
                source: "Banners",
              });
            })
            .filter(Boolean),
        ),
    );

    // Direct Brands (admin direct-brands)
    // queries.push(
    //   DirectBrand.find({
    //     $or: [
    //       { name: rx },
    //       { offerText: rx },
    //       { couponCode: rx },
    //       { category: rx },
    //     ],
    //   })
    //     .sort({ priority: -1, updatedAt: -1 })
    //     .limit(per.directBrands)
    //     .select("name offerText couponCode category")
    //     .lean()
    //     .then((rows) =>
    //       rows
    //         .map((d) =>
    //           makeItem({
    //             type: "brand",
    //             title: d.name || "Brand",
    //             description: d.offerText || d.couponCode || d.category || "",
    //             // best-effort: launchpad is where brand tiles usually live
    //             route: "/launchpad",
    //             source: "Direct Brands",
    //           })
    //         )
    //         .filter(Boolean)
    //     )
    // );

    // Gift Cards
    queries.push(
      VdBrand.find({
        enabled: true,
        $or: [
          { BrandName: rx },
          { BrandCode: rx },
          { Category: rx },
          { Description: rx },
        ],
      })
        .sort({ popularity: -1, updatedAt: -1, createdAt: -1 })
        .limit(per.giftcards)
        .select("BrandName BrandCode Category Description popularity")
        .lean()
        .then((rows) =>
          rows
            .map((g) => {
              const title = String(g.BrandName || "").trim();
              const brandCode = String(g.BrandCode || "").trim();
              const description =
                g.Description ||
                (g.Category ? `Category: ${g.Category}` : "") ||
                (brandCode ? `Code: ${brandCode}` : "");

              const qLower = q.toLowerCase();
              const titleLower = title.toLowerCase();
              const codeLower = brandCode.toLowerCase();

              let score = 0;
              if (titleLower === qLower || codeLower === qLower) score += 1000;
              if (titleLower.startsWith(qLower) || codeLower.startsWith(qLower))
                score += 200;
              if (titleLower.includes(qLower) || codeLower.includes(qLower))
                score += 100;
              if (g.popularity) score += 15;

              return makeItem({
                type: "giftcard",
                title: title || brandCode || "Gift Card",
                description,
                route: brandCode
                  ? `/gift-cards/${encodeURIComponent(brandCode)}`
                  : "",
                source: "Gift Cards",
                score,
                brandCode,
              });
            })
            .filter(Boolean),
        ),
    );

    // Amazon Banners (optional model)
    // if (AmazonBanner) {
    //   queries.push(
    //     AmazonBanner.find({ $or: [{ title: rx }, { description: rx }] })
    //       .sort({ createdAt: -1 })
    //       .limit(per.amazonBanners)
    //       .select("title description link")
    //       .lean()
    //       .then((rows) =>
    //         rows
    //           .map((b) => {
    //             const link = String(b.link || "");
    //             const internal = link.startsWith("/") ? link : "/amazon-deals";
    //             return makeItem({
    //               type: "amazon",
    //               title: b.title || "Amazon",
    //               description: b.description || "",
    //               route: internal,
    //               source: "Amazon Banners",
    //             });
    //           })
    //           .filter(Boolean)
    //       )
    //   );
    // }

    const groups = await Promise.all(queries);
    const flat = groups.flat().filter(Boolean);

    // Lightweight ranking: title match first
    const qLower = q.toLowerCase();
    flat.sort((a, b) => {
      const as = Number(a.score || 0);
      const bs = Number(b.score || 0);
      if (as !== bs) return bs - as;

      const at = String(a.title || "").toLowerCase();
      const bt = String(b.title || "").toLowerCase();
      const aStarts = at.startsWith(qLower) ? 1 : 0;
      const bStarts = bt.startsWith(qLower) ? 1 : 0;
      if (aStarts !== bStarts) return bStarts - aStarts;
      const aHas = at.includes(qLower) ? 1 : 0;
      const bHas = bt.includes(qLower) ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      return 0;
    });

    // hard cap
    const items = flat.slice(0, limit);
    return res.json({ ok: true, q, items });
  } catch (err) {
    console.error("GET /api/search error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

module.exports = router;
