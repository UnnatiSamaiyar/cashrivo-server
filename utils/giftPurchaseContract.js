"use strict";

const PURCHASE_TYPES = new Set(["SELF", "GIFT"]);
const DELIVERY_MODES = new Set(["INSTANT", "SCHEDULED"]);
const DELIVERY_CHANNELS = new Set(["EMAIL", "MOBILE", "EMAIL_AND_MOBILE", "SELF"]);

function clean(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function normalizeEmail(value) {
  return clean(value, 180).toLowerCase();
}

function normalizeMobile(value) {
  return clean(value, 30).replace(/[^0-9+]/g, "");
}

function resolveChannel(recipient) {
  const hasEmail = !!recipient.email;
  const hasMobile = !!recipient.mobile;
  if (hasEmail && hasMobile) return "EMAIL_AND_MOBILE";
  if (hasMobile) return "MOBILE";
  if (hasEmail) return "EMAIL";
  return "EMAIL";
}

function normalizeGiftPurchaseContract(body = {}) {
  const inferredType = body.recipient && typeof body.recipient === "object" ? "GIFT" : "SELF";
  const rawType = clean(body.purchase_type || body.purchaseType || inferredType, 16).toUpperCase();
  const purchase_type = PURCHASE_TYPES.has(rawType) ? rawType : "SELF";

  if (purchase_type !== "GIFT") {
    return {
      purchase_type: "SELF",
      recipient: null,
      delivery: {
        mode: "INSTANT",
        scheduled_at: null,
        channel: "SELF",
        status: "NOT_REQUIRED",
      },
    };
  }

  const rawRecipient = body.recipient && typeof body.recipient === "object" ? body.recipient : {};
  const recipient = {
    name: clean(rawRecipient.name, 120),
    email: normalizeEmail(rawRecipient.email),
    mobile: normalizeMobile(rawRecipient.mobile),
    message: clean(rawRecipient.message, 180),
  };

  const rawDelivery = body.delivery && typeof body.delivery === "object" ? body.delivery : {};
  const rawMode = clean(rawDelivery.mode || "INSTANT", 20).toUpperCase();
  const mode = DELIVERY_MODES.has(rawMode) ? rawMode : "INSTANT";
  const rawChannel = clean(rawDelivery.channel || resolveChannel(recipient), 30).toUpperCase();
  const channel = DELIVERY_CHANNELS.has(rawChannel) ? rawChannel : resolveChannel(recipient);

  return {
    purchase_type: "GIFT",
    recipient,
    delivery: {
      mode,
      scheduled_at: rawDelivery.scheduled_at ? new Date(rawDelivery.scheduled_at) : null,
      channel,
      status: clean(rawDelivery.status || "PENDING", 30).toUpperCase() || "PENDING",
    },
  };
}

function hasGiftPurchaseContractPayload(body = {}) {
  return Object.prototype.hasOwnProperty.call(body, "purchase_type") ||
    Object.prototype.hasOwnProperty.call(body, "purchaseType") ||
    Object.prototype.hasOwnProperty.call(body, "recipient") ||
    Object.prototype.hasOwnProperty.call(body, "delivery");
}

function normalizeStoredGiftPurchaseContract(purchase = {}) {
  const rawType = clean(purchase.purchase_type || purchase.purchaseType || "SELF", 16).toUpperCase();
  const purchase_type = PURCHASE_TYPES.has(rawType) ? rawType : "SELF";

  if (purchase_type !== "GIFT") {
    return normalizeGiftPurchaseContract({ purchase_type: "SELF" });
  }

  return normalizeGiftPurchaseContract({
    purchase_type: "GIFT",
    recipient: purchase.recipient || {},
    delivery: purchase.delivery || {},
  });
}

function assertGiftPurchaseContract(contract) {
  if (!contract || contract.purchase_type !== "GIFT") return;
  const recipient = contract.recipient || {};
  if (!recipient.name) throw new Error("Recipient name is required");
  if (!recipient.email) throw new Error("Recipient email is required");
  if (!recipient.mobile) throw new Error("Recipient phone number is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email)) {
    throw new Error("Valid recipient email is required");
  }
  if (recipient.mobile.replace(/\D/g, "").length < 10) {
    throw new Error("Valid recipient mobile is required");
  }
}

module.exports = {
  normalizeGiftPurchaseContract,
  normalizeStoredGiftPurchaseContract,
  hasGiftPurchaseContractPayload,
  assertGiftPurchaseContract,
};
