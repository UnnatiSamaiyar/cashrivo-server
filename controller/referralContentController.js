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

const buildReferralContentPayload = (settings) => ({
  shareSubject: settings.shareSubject,
  shareMessageTemplate: settings.shareMessageTemplate,
  playStoreUrl: settings.playStoreUrl,
  appStoreUrl: settings.appStoreUrl,
  isActive: settings.isActive,
  placeholders: ["{{referralCode}}", "{{playStoreUrl}}", "{{appStoreUrl}}"],
  updatedByUserId: settings.updatedByUserId,
  updatedAt: settings.updatedAt,
});

exports.getReferralContent = async (req, res) => {
  try {
    const settings = await ensureSettingsDocument();
    const referralContent = buildReferralContentPayload(settings);

    return res.status(200).json({
      success: true,
      referralContent,
      data: referralContent,
      settings: referralContent,
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
      updatedByUserId: sanitizeLine(req.user?.userId || req.user?.id || "admin") || "admin",
    };

    if (shareSubject !== undefined) {
      const trimmedSubject = sanitizeLine(shareSubject, DEFAULT_SETTINGS.shareSubject);
      if (!trimmedSubject) {
        return sendError(res, 400, "VALIDATION_ERROR", "Share subject is required");
      }
      update.shareSubject = trimmedSubject;
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

    const referralContent = buildReferralContentPayload(settings);

    return res.status(200).json({
      success: true,
      referralContent,
      data: referralContent,
      settings: referralContent,
      message: "Referral content updated successfully",
    });
  } catch (err) {
    console.error("upsertReferralContent error:", err);
    return sendError(res, 500, "SERVER_ERROR", err.message || "Server error");
  }
};
