"use strict";

const express = require("express");

const Blog = require("../models/Blogs");
const LmdOffer = require("../models/LmdOffers");
const DirectBrand = require("../models/DirectBrand");
const AmazonBanner = require("../models/AmazonBanner");
const ExclusiveBanner = require("../models/ExclusiveDeals");
const Banner = require("../models/bannerModel");

const router = express.Router();

function clamp(n, min, max) {
  n = Number(n);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function normalize(text = "") {
  return String(text)
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u2018\u2019\u201c\u201d]/g, " ")
    .replace(/[^0-9A-Za-z]+/g, " ")
    .toLowerCase()
    .trim();
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scoreDoc(qTokens, fields) {
  // fields: { title, description, tags }
  const title = normalize(fields.title || "");
  const desc = normalize(fields.description || "");
  const tags = normalize(Array.isArray(fields.tags) ? fields.tags.join(" ") : fields.tags || "");

  let score = 0;
  for (const t of qTokens) {
    if (!t) continue;

    // Exact token matches (word boundaries)
    const re = new RegExp(`\\b${escapeRegex(t)}\\b`, "g");
    const titleHits = (title.match(re) || []).length;
    const descHits = (desc.match(re) || []).length;
    const tagHits = (tags.match(re) || []).length;

    score += titleHits * 50;
    score += descHits * 15;
    score += tagHits * 10;

    // Prefix boost
    if (title.startsWith(t)) score += 40;
    if (desc.startsWith(t)) score += 10;
  }

  // Small boost for shorter titles (usually higher intent)
  const titleLen = title.length || 1;
  score += Math.max(0, 20 - Math.min(20, Math.floor(titleLen / 12)));

  return score;
}

function buildRegexQuery(qTokens) {
  // AND semantics across tokens, tolerant prefix matches.
  // We keep regex simple + safe (escaped) to avoid ReDoS.
  return qTokens
    .filter(Boolean)
    .slice(0, 6)
    .map((t) => new RegExp(escapeRegex(t), "i"));
}

router.get("/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const limit = clamp(req.query.limit || 20, 5, 50);

    if (!q || q.length < 2) {
      return res.json({ ok: true, q, results: [] });
    }

    const qTokens = normalize(q).split(/\s+/).filter(Boolean).slice(0, 8);
    if (!qTokens.length) {
      return res.json({ ok: true, q, results: [] });
    }

    const regs = buildRegexQuery(qTokens);

    const [blogs, offers, brands, amazonBanners, exclusiveBanners, miscBanners] =
      await Promise.all([
        Blog.find({
          $and: regs.map((r) => ({
            $or: [
              { title: r },
              { description: r },
              { tags: r },
              { category: r },
              { content: r },
            ],
          })),
        })
          .select("title slug description tags category featuredImage bannerImage updatedAt")
          .sort({ updatedAt: -1 })
          .limit(25)
          .lean(),

        LmdOffer.find({
          status: { $ne: "inactive" },
          $and: regs.map((r) => ({
            $or: [
              { title: r },
              { description: r },
              { long_offer: r },
              { store: r },
              { code: r },
              { categories: r },
            ],
          })),
        })
          .select("title description long_offer store categories code image_url updatedAt")
          .sort({ updatedAt: -1 })
          .limit(40)
          .lean(),

        DirectBrand.find({
          isActive: true,
          $and: regs.map((r) => ({
            $or: [{ name: r }, { description: r }, { category: r }, { tags: r }],
          })),
        })
          .select("name slug description category logoUrl bannerUrl priority updatedAt")
          .sort({ priority: -1, updatedAt: -1 })
          .limit(25)
          .lean(),

        AmazonBanner.find({
          $and: regs.map((r) => ({ $or: [{ title: r }, { description: r }] })),
        })
          .select("title description imageUrl link updatedAt")
          .sort({ updatedAt: -1 })
          .limit(15)
          .lean(),

        ExclusiveBanner.find({
          $and: regs.map((r) => ({ $or: [{ title: r }, { description: r }] })),
        })
          .select("title description imageUrl link updatedAt")
          .sort({ updatedAt: -1 })
          .limit(15)
          .lean(),

        Banner.find({
          $and: regs.map((r) => ({ $or: [{ title: r }, { altText: r }, { code: r }] })),
        })
          .select("title altText imageUrl link code updatedAt")
          .sort({ updatedAt: -1 })
          .limit(10)
          .lean(),
      ]);

    const results = [];

    for (const b of blogs) {
      const title = b.title || "Blog";
      const description = b.description || "";
      const score = scoreDoc(qTokens, { title, description, tags: b.tags });
      results.push({
        id: String(b._id),
        type: "blog",
        title,
        description,
        imageUrl: b.featuredImage || b.bannerImage || "",
        route: `/blog/${encodeURIComponent(b.slug || "")}`,
        source: "blogs",
        score,
      });
    }

    for (const o of offers) {
      const title = o.title || o.long_offer || "Offer";
      const description = o.description || o.long_offer || "";
      const score = scoreDoc(qTokens, {
        title,
        description,
        tags: [o.store, ...(o.categories || [])].filter(Boolean),
      });
      // Offers are rendered in /exclusive-deals and /deal/:id in this client.
      // If you later add a dedicated route for LMD offers, you can swap route here.
      results.push({
        id: String(o._id),
        type: "deal",
        title,
        description,
        imageUrl: o.image_url || "",
        route: `/deal/${encodeURIComponent(String(o._id))}`,
        source: "lmdoffers",
        score,
      });
    }

    for (const s of brands) {
      const title = s.name || "Store";
      const description = s.description || s.category || "";
      const score = scoreDoc(qTokens, {
        title,
        description,
        tags: [s.category].filter(Boolean),
      });
      results.push({
        id: String(s._id),
        type: "store",
        title,
        description,
        imageUrl: s.logoUrl || s.bannerUrl || "",
        route: `/stores/${encodeURIComponent(s.slug || s.name || "")}`,
        source: "stores",
        score,
      });
    }

    for (const a of amazonBanners) {
      const title = a.title || "Banner";
      const description = a.description || "";
      const score = scoreDoc(qTokens, { title, description, tags: ["amazon"] });
      results.push({
        id: String(a._id),
        type: "banner",
        title,
        description,
        imageUrl: a.imageUrl || "",
        route: "/",
        anchorId: "hero-slider",
        source: "amazon",
        score,
      });
    }

    for (const e of exclusiveBanners) {
      const title = e.title || "Banner";
      const description = e.description || "";
      const score = scoreDoc(qTokens, { title, description, tags: ["exclusive"] });
      results.push({
        id: String(e._id),
        type: "banner",
        title,
        description,
        imageUrl: e.imageUrl || "",
        route: "/",
        anchorId: "exclusive-deals",
        source: "exclusive",
        score,
      });
    }

    for (const bn of miscBanners) {
      const title = bn.title || bn.altText || "Banner";
      const description = bn.altText || bn.code || "";
      const score = scoreDoc(qTokens, { title, description, tags: [] });
      results.push({
        id: String(bn._id),
        type: "banner",
        title,
        description,
        imageUrl: bn.imageUrl || "",
        route: bn.link || "/",
        source: "banners",
        score,
      });
    }

    // Sort + slice
    const finalResults = results
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    res.json({ ok: true, q, results: finalResults });
  } catch (err) {
    console.error("/api/search error:", err);
    res.status(500).json({ ok: false, error: "search_failed" });
  }
});

module.exports = router;
