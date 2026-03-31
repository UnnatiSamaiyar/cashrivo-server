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

function buildEmptyDocument(platform, documentType) {
  return {
    _id: null,
    platform,
    documentType,
    title: POLICY_META[documentType]?.title || "",
    summary: "",
    content: "",
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
    const { documentType, title, summary = "", content = "", isPublished = true } = req.body || {};

    if (!isValidPlatform(platform)) {
      return res.status(400).json({ message: "Invalid platform" });
    }
    if (!isValidDocumentType(documentType)) {
      return res.status(400).json({ message: "Invalid policy type" });
    }
    if (!String(title || "").trim()) {
      return res.status(400).json({ message: "Title is required" });
    }

    const exists = await PolicyDocument.findOne({ platform, documentType }).lean();
    if (exists) {
      return res.status(409).json({ message: "Policy already exists for this platform and type" });
    }

    const doc = await PolicyDocument.create({
      platform,
      documentType,
      title: String(title).trim(),
      summary: String(summary || "").trim(),
      content: String(content || ""),
      isPublished: Boolean(isPublished),
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
    const { title, summary = "", content = "", isPublished = true } = req.body || {};

    if (!isValidPlatform(platform)) {
      return res.status(400).json({ message: "Invalid platform" });
    }
    if (!isValidDocumentType(documentType)) {
      return res.status(400).json({ message: "Invalid policy type" });
    }
    if (!String(title || "").trim()) {
      return res.status(400).json({ message: "Title is required" });
    }

    const existing = await PolicyDocument.findOne({ platform, documentType });
    if (!existing) {
      const created = await PolicyDocument.create({
        platform,
        documentType,
        title: String(title).trim(),
        summary: String(summary || "").trim(),
        content: String(content || ""),
        isPublished: Boolean(isPublished),
        publishedAt: new Date(),
        lastEditedAt: new Date(),
        version: 1,
      });

      return res.status(201).json({
        message: "Policy created successfully",
        document: serializeDocument(created),
      });
    }

    existing.title = String(title).trim();
    existing.summary = String(summary || "").trim();
    existing.content = String(content || "");
    existing.isPublished = Boolean(isPublished);
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
