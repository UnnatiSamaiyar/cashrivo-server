const express = require("express");
const PolicyDocument = require("../models/PolicyDocument");

const router = express.Router();

const POLICY_META = {
  "privacy-policy": { title: "Privacy Policy", order: 1 },
  "terms-of-use": { title: "Terms of Use", order: 2 },
  "refund-policy": { title: "Refund Policy", order: 3 },
  disclaimer: { title: "Disclaimer", order: 4 },
  faqs: { title: "FAQs", order: 5 },
};

function isValidPlatform(platform) {
  return ["website", "app"].includes(platform);
}

function isValidDocumentType(documentType) {
  return Boolean(POLICY_META[documentType]);
}

function normalizeFaqItems(faqItems = []) {
  if (!Array.isArray(faqItems)) return [];

  return faqItems
    .map((item, index) => ({
      question: String(item?.question || "").trim(),
      answer: String(item?.answer || "").trim(),
      order: Number.isFinite(Number(item?.order)) ? Number(item.order) : index,
    }))
    .filter((item) => item.question || item.answer)
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index }));
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderFaqHtml(faqItems = []) {
  const normalized = normalizeFaqItems(faqItems);

  if (!normalized.length) {
    return "";
  }

  const blocks = normalized
    .map(
      (item, index) => `
        <section data-faq-item="true" data-faq-order="${index}" style="border:1px solid #e2e8f0; border-radius:16px; padding:18px 20px; margin:0 0 14px 0; background:#ffffff;">
          <h3 style="margin:0 0 10px 0; font-size:18px; line-height:1.5; color:#0f172a;">${escapeHtml(item.question)}</h3>
          <div style="font-size:15px; line-height:1.8; color:#475569; white-space:pre-wrap;">${escapeHtml(item.answer)}</div>
        </section>
      `
    )
    .join("");

  return `<div data-policy-faqs="true">${blocks}</div>`;
}

function buildEmptyDocument(platform, documentType) {
  return {
    _id: null,
    platform,
    documentType,
    title: POLICY_META[documentType]?.title || "",
    summary: "",
    content: "",
    websiteUrl: "",
    faqItems: [],
    isPublished: true,
    version: 1,
    publishedAt: null,
    lastEditedAt: null,
    exists: false,
  };
}

function serializeDocument(doc) {
  return {
    _id: doc._id,
    platform: doc.platform,
    documentType: doc.documentType,
    title: doc.title,
    summary: doc.summary || "",
    content: doc.content || "",
    websiteUrl: doc.websiteUrl || "",
    faqItems: normalizeFaqItems(doc.faqItems || []),
    isPublished: Boolean(doc.isPublished),
    version: doc.version || 1,
    publishedAt: doc.publishedAt,
    lastEditedAt: doc.lastEditedAt,
    updatedAt: doc.updatedAt,
    createdAt: doc.createdAt,
    exists: true,
  };
}

async function listForPlatform(platform) {
  const docs = await PolicyDocument.find({ platform }).lean();
  const byType = new Map(docs.map((doc) => [doc.documentType, doc]));

  return Object.entries(POLICY_META)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([documentType, meta]) => {
      const existing = byType.get(documentType);
      return existing
        ? {
            ...serializeDocument(existing),
            title: existing.title || meta.title,
          }
        : buildEmptyDocument(platform, documentType);
    });
}

function getDocumentPayload(documentType, body = {}) {
  const basePayload = {
    title: String(body.title || "").trim(),
    summary: String(body.summary || "").trim(),
    websiteUrl: String(body.websiteUrl || "").trim(),
    isPublished: Boolean(body.isPublished),
  };

  if (documentType === "faqs") {
    const faqItems = normalizeFaqItems(body.faqItems || []);
    const fallbackContent = renderFaqHtml(faqItems);
    return {
      ...basePayload,
      faqItems,
      content: String(body.content || fallbackContent || ""),
    };
  }

  return {
    ...basePayload,
    content: String(body.content || ""),
    faqItems: [],
  };
}

router.get("/admin/:platform/policies", async (req, res) => {
  try {
    const { platform } = req.params;
    if (!isValidPlatform(platform)) {
      return res.status(400).json({ message: "Invalid platform" });
    }

    const documents = await listForPlatform(platform);
    return res.json({ platform, documents });
  } catch (error) {
    console.error("Failed to fetch policy documents:", error);
    return res.status(500).json({ message: "Failed to fetch policy documents" });
  }
});

router.get("/admin/:platform/policies/:documentType", async (req, res) => {
  try {
    const { platform, documentType } = req.params;
    if (!isValidPlatform(platform)) {
      return res.status(400).json({ message: "Invalid platform" });
    }
    if (!isValidDocumentType(documentType)) {
      return res.status(400).json({ message: "Invalid policy type" });
    }

    const doc = await PolicyDocument.findOne({ platform, documentType }).lean();
    if (!doc) {
      return res.json({
        platform,
        document: buildEmptyDocument(platform, documentType),
      });
    }

    return res.json({ platform, document: serializeDocument(doc) });
  } catch (error) {
    console.error("Failed to fetch policy document:", error);
    return res.status(500).json({ message: "Failed to fetch policy document" });
  }
});

router.post("/admin/:platform/policies", async (req, res) => {
  try {
    const { platform } = req.params;
    const { documentType } = req.body || {};

    if (!isValidPlatform(platform)) {
      return res.status(400).json({ message: "Invalid platform" });
    }
    if (!isValidDocumentType(documentType)) {
      return res.status(400).json({ message: "Invalid policy type" });
    }

    const payload = getDocumentPayload(documentType, req.body || {});

    if (!payload.title) {
      return res.status(400).json({ message: "Title is required" });
    }

    const exists = await PolicyDocument.findOne({ platform, documentType }).lean();
    if (exists) {
      return res.status(409).json({ message: "Policy already exists for this platform and type" });
    }

    const doc = await PolicyDocument.create({
      platform,
      documentType,
      ...payload,
      publishedAt: new Date(),
      lastEditedAt: new Date(),
      version: 1,
    });

    return res.status(201).json({ message: "Policy created successfully", document: serializeDocument(doc) });
  } catch (error) {
    console.error("Failed to create policy document:", error);
    return res.status(500).json({ message: "Failed to create policy document" });
  }
});

router.put("/admin/:platform/policies/:documentType", async (req, res) => {
  try {
    const { platform, documentType } = req.params;

    if (!isValidPlatform(platform)) {
      return res.status(400).json({ message: "Invalid platform" });
    }
    if (!isValidDocumentType(documentType)) {
      return res.status(400).json({ message: "Invalid policy type" });
    }

    const payload = getDocumentPayload(documentType, req.body || {});

    if (!payload.title) {
      return res.status(400).json({ message: "Title is required" });
    }

    const existing = await PolicyDocument.findOne({ platform, documentType });
    if (!existing) {
      const created = await PolicyDocument.create({
        platform,
        documentType,
        ...payload,
        content: documentType === "faqs" ? (payload.content || renderFaqHtml(payload.faqItems)) : payload.content,
        publishedAt: new Date(),
        lastEditedAt: new Date(),
        version: 1,
      });

      return res.status(201).json({
        message: "Policy created successfully",
        document: serializeDocument(created),
      });
    }

    existing.title = payload.title;
    existing.summary = payload.summary;
    existing.content = documentType === "faqs" ? (payload.content || renderFaqHtml(payload.faqItems)) : payload.content;
    existing.faqItems = payload.faqItems;
    existing.isPublished = payload.isPublished;
    existing.lastEditedAt = new Date();
    if (existing.isPublished) {
      existing.publishedAt = existing.publishedAt || new Date();
    }
    existing.version = Number(existing.version || 1) + 1;

    await existing.save();

    return res.json({
      message: "Policy updated successfully",
      document: serializeDocument(existing),
    });
  } catch (error) {
    console.error("Failed to update policy document:", error);
    return res.status(500).json({ message: "Failed to update policy document" });
  }
});

router.delete("/admin/:platform/policies/:documentType", async (req, res) => {
  try {
    const { platform, documentType } = req.params;
    if (!isValidPlatform(platform)) {
      return res.status(400).json({ message: "Invalid platform" });
    }
    if (!isValidDocumentType(documentType)) {
      return res.status(400).json({ message: "Invalid policy type" });
    }

    const deleted = await PolicyDocument.findOneAndDelete({ platform, documentType });
    if (!deleted) {
      return res.status(404).json({ message: "Policy not found" });
    }

    return res.json({ message: "Policy deleted successfully" });
  } catch (error) {
    console.error("Failed to delete policy document:", error);
    return res.status(500).json({ message: "Failed to delete policy document" });
  }
});

router.get("/:platform/policies", async (req, res) => {
  try {
    const { platform } = req.params;
    if (!isValidPlatform(platform)) {
      return res.status(400).json({ message: "Invalid platform" });
    }

    const docs = await PolicyDocument.find({ platform, isPublished: true })
      .sort({ updatedAt: -1 })
      .lean();

    const documents = docs
      .map((doc) => serializeDocument(doc))
      .sort((a, b) => (POLICY_META[a.documentType]?.order || 999) - (POLICY_META[b.documentType]?.order || 999));

    return res.json({ platform, documents });
  } catch (error) {
    console.error("Failed to fetch public policies:", error);
    return res.status(500).json({ message: "Failed to fetch public policies" });
  }
});

router.get("/:platform/policies/:documentType", async (req, res) => {
  try {
    const { platform, documentType } = req.params;
    if (!isValidPlatform(platform)) {
      return res.status(400).json({ message: "Invalid platform" });
    }
    if (!isValidDocumentType(documentType)) {
      return res.status(400).json({ message: "Invalid policy type" });
    }

    const doc = await PolicyDocument.findOne({
      platform,
      documentType,
      isPublished: true,
    }).lean();

    if (!doc) {
      return res.status(404).json({ message: "Policy not found" });
    }

    return res.json({ platform, document: serializeDocument(doc) });
  } catch (error) {
    console.error("Failed to fetch public policy:", error);
    return res.status(500).json({ message: "Failed to fetch public policy" });
  }
});

module.exports = router;
