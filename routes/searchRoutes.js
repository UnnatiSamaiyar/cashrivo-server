"use strict";

const express = require("express");

// Models (keep this list small + high-signal; add more later if needed)
const Blog = require("../models/Blogs");
const Coupon = require("../models/Coupon");
const Banner = require("../models/bannerModel");
let AmazonBanner;
try {
  AmazonBanner = require("../models/AmazonBanner");
} catch (_) {
  AmazonBanner = null;
}

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

function makeItem({ type, title, description, route, source, score }) {
  if (!title || !route) return null;
  return {
    type,
    title,
    description: description || "",
    route,
    source: source || undefined,
    score: typeof score === "number" ? score : undefined,
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
      banners: Math.min(4, limit),
      amazonBanners: Math.min(4, limit),
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
              })
            )
            .filter(Boolean)
        )
    );

    // Coupons (Deals)
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
        .limit(per.coupons)
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
                  (c.storeName && c.category ? `${c.storeName} • ${c.category}` : c.storeName || c.category || ""),
                route: c._id ? `/deal/${String(c._id)}` : "",
                source: "Coupons",
              })
            )
            .filter(Boolean)
        )
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
              const internal = link.startsWith("/") ? link : "/";
              return makeItem({
                type: "banner",
                title: b.title || b.altText || "Banner",
                description: b.altText || b.code || "",
                route: internal,
                source: "Banners",
              });
            })
            .filter(Boolean)
        )
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

    // Amazon Banners (optional model)
    if (AmazonBanner) {
      queries.push(
        AmazonBanner.find({ $or: [{ title: rx }, { description: rx }] })
          .sort({ createdAt: -1 })
          .limit(per.amazonBanners)
          .select("title description link")
          .lean()
          .then((rows) =>
            rows
              .map((b) => {
                const link = String(b.link || "");
                const internal = link.startsWith("/") ? link : "/amazon-deals";
                return makeItem({
                  type: "amazon",
                  title: b.title || "Amazon",
                  description: b.description || "",
                  route: internal,
                  source: "Amazon Banners",
                });
              })
              .filter(Boolean)
          )
      );
    }

    const groups = await Promise.all(queries);
    const flat = groups.flat().filter(Boolean);

    // Lightweight ranking: title match first
    const qLower = q.toLowerCase();
    flat.sort((a, b) => {
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
