"use strict";

const ReferralContentSettings = require("../models/ReferralContentSettings");

const DEFAULT_KEY = "main";

const DEFAULT_SETTINGS = {
  key: DEFAULT_KEY,
  shareSubject: "Join Cashrivo with my referral code",
  shareMessageTemplate:
    "{{referralCode}} is your Cashrivo referral code.\nUse this code during sign up to join Cashrivo through my invite.\nThis referral code works while the invite remains active.\n\nSave smarter with Cashrivo. Buy gift cards, unlock coupons and earn RivoPoints.\nReferral code: {{referralCode}}\n{{playStoreUrl}}",
  playStoreUrl: "",
  appStoreUrl: "",
  isActive: true,
};

const sendError = (res, status, code, message) => {
  return res.status(status).json({
    success: false,
    code,
    message,
    msg: message,
  });
};

const parseAdminList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const isValidOptionalUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return true;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch (_) {
    return false;
  }
};

const sanitizeLine = (value, fallback = "") => String(value ?? fallback).trim();

const ensureSettingsDocument = async () => {
  const existing = await ReferralContentSettings.findOne({ key: DEFAULT_KEY });
  if (existing) return existing;

  return ReferralContentSettings.create(DEFAULT_SETTINGS);
};

const resolveTemplate = ({ template, referralCode, playStoreUrl, appStoreUrl }) => {
  const replacements = {
    referralCode: String(referralCode || "").trim(),
    playStoreUrl: String(playStoreUrl || "").trim(),
    appStoreUrl: String(appStoreUrl || "").trim(),
  };

  return String(template || "")
    .replace(/\{\{\s*referralCode\s*\}\}/gi, replacements.referralCode)
    .replace(/\{\{\s*playStoreUrl\s*\}\}/gi, replacements.playStoreUrl)
    .replace(/\{\{\s*appStoreUrl\s*\}\}/gi, replacements.appStoreUrl)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const hasAdminAccess = (req) => {
  const user = req.user || {};

  const adminSecretHeader = String(req.headers["x-admin-secret"] || "").trim();
  const adminSecretEnv = String(process.env.ADMIN_PANEL_SECRET || "").trim();
  if (adminSecretHeader && adminSecretEnv && adminSecretHeader === adminSecretEnv) {
    return true;
  }

  const allowedUserIds = parseAdminList(process.env.ADMIN_USER_IDS);
  const allowedMongoIds = parseAdminList(process.env.ADMIN_MONGO_IDS);
  const allowedEmails = parseAdminList(process.env.ADMIN_EMAILS).map((item) => item.toLowerCase());
  const allowedPhones = parseAdminList(process.env.ADMIN_PHONES);

  if (user.userId && allowedUserIds.includes(String(user.userId).trim())) return true;
  if (user.id && allowedMongoIds.includes(String(user.id).trim())) return true;
  if (user.email && allowedEmails.includes(String(user.email).trim().toLowerCase())) return true;
  if (user.phone && allowedPhones.includes(String(user.phone).trim())) return true;

  return false;
};

exports.getReferralContent = async (req, res) => {
  try {
    const settings = await ensureSettingsDocument();

    return res.status(200).json({
      success: true,
      referralContent: {
        shareSubject: settings.shareSubject,
        shareMessageTemplate: settings.shareMessageTemplate,
        playStoreUrl: settings.playStoreUrl,
        appStoreUrl: settings.appStoreUrl,
        isActive: settings.isActive,
        placeholders: ["{{referralCode}}", "{{playStoreUrl}}", "{{appStoreUrl}}"],
        updatedByUserId: settings.updatedByUserId,
        updatedAt: settings.updatedAt,
      },
      message: "Referral content fetched successfully",
    });
  } catch (err) {
    console.error("getReferralContent error:", err);
    return sendError(res, 500, "SERVER_ERROR", err.message || "Server error");
  }
};

exports.getReferralContentPreview = async (req, res) => {
  try {
    const settings = await ensureSettingsDocument();

    const referralCode = sanitizeLine(req.query.referralCode, req.user?.userId || "");
    const playStoreUrl = sanitizeLine(req.query.playStoreUrl, settings.playStoreUrl);
    const appStoreUrl = sanitizeLine(req.query.appStoreUrl, settings.appStoreUrl);

    return res.status(200).json({
      success: true,
      preview: {
        shareSubject: settings.shareSubject,
        shareText: resolveTemplate({
          template: settings.shareMessageTemplate,
          referralCode,
          playStoreUrl,
          appStoreUrl,
        }),
        referralCode,
        playStoreUrl,
        appStoreUrl,
      },
      message: "Referral content preview fetched successfully",
    });
  } catch (err) {
    console.error("getReferralContentPreview error:", err);
    return sendError(res, 500, "SERVER_ERROR", err.message || "Server error");
  }
};

exports.upsertReferralContent = async (req, res) => {
  try {
    if (!req.user?.id) {
      return sendError(res, 401, "UNAUTHORIZED", "Authentication required");
    }

    if (!hasAdminAccess(req)) {
      return sendError(
        res,
        403,
        "FORBIDDEN",
        "Admin access required. Configure ADMIN_USER_IDS / ADMIN_EMAILS / ADMIN_MONGO_IDS / ADMIN_PHONES or ADMIN_PANEL_SECRET."
      );
    }

    const {
      shareSubject,
      shareMessageTemplate,
      playStoreUrl,
      appStoreUrl,
      isActive,
    } = req.body || {};

    if (playStoreUrl !== undefined && !isValidOptionalUrl(playStoreUrl)) {
      return sendError(res, 400, "VALIDATION_ERROR", "Invalid Play Store URL");
    }

    if (appStoreUrl !== undefined && !isValidOptionalUrl(appStoreUrl)) {
      return sendError(res, 400, "VALIDATION_ERROR", "Invalid App Store URL");
    }

    const update = {
      updatedByUserId: String(req.user.userId || req.user.id || "").trim() || null,
    };

    if (shareSubject !== undefined) {
      update.shareSubject = sanitizeLine(shareSubject, DEFAULT_SETTINGS.shareSubject);
    }

    if (shareMessageTemplate !== undefined) {
      const trimmedTemplate = String(shareMessageTemplate || "").trim();
      if (!trimmedTemplate) {
        return sendError(res, 400, "VALIDATION_ERROR", "Share message template is required");
      }
      update.shareMessageTemplate = trimmedTemplate;
    }

    if (playStoreUrl !== undefined) {
      update.playStoreUrl = sanitizeLine(playStoreUrl);
    }

    if (appStoreUrl !== undefined) {
      update.appStoreUrl = sanitizeLine(appStoreUrl);
    }

    if (isActive !== undefined) {
      update.isActive = Boolean(isActive);
    }

    const settings = await ReferralContentSettings.findOneAndUpdate(
      { key: DEFAULT_KEY },
      { $set: update, $setOnInsert: DEFAULT_SETTINGS },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      success: true,
      referralContent: {
        shareSubject: settings.shareSubject,
        shareMessageTemplate: settings.shareMessageTemplate,
        playStoreUrl: settings.playStoreUrl,
        appStoreUrl: settings.appStoreUrl,
        isActive: settings.isActive,
        placeholders: ["{{referralCode}}", "{{playStoreUrl}}", "{{appStoreUrl}}"],
        updatedByUserId: settings.updatedByUserId,
        updatedAt: settings.updatedAt,
      },
      message: "Referral content updated successfully",
    });
  } catch (err) {
    console.error("upsertReferralContent error:", err);
    return sendError(res, 500, "SERVER_ERROR", err.message || "Server error");
  }
};
