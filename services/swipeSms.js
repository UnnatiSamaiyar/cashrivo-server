"use strict";

const axios = require("axios");

function env(name, fallback = "") {
  return (process.env[name] ?? fallback).toString();
}

function requireEnv(name) {
  const v = env(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function digitsOnly(s) {
  return String(s || "").replace(/\D+/g, "");
}

/**
 * Send OTP SMS via Swipe SendSmsV2.
 *
 * @param {Object} opts
 * @param {string} opts.toE164Digits  e.g. "919319328637" (digits only)
 * @param {string} opts.messageText   full sms text
 * @returns {Promise<{ok:boolean, raw:any}>}
 */
async function sendOtpSms({ toE164Digits, messageText }) {
  const url = env("SWIPE_SMS_URL", "https://sandesh.swipemessage.net:5667/SendSmsV2");
  const apiToken = requireEnv("SWIPE_SMS_API_TOKEN");
  const sourceAddress = requireEnv("SWIPE_SMS_SOURCE_ADDRESS");

  const destinationAddress = digitsOnly(toE164Digits);
  if (!destinationAddress) throw new Error("Missing destinationAddress");
  if (!messageText) throw new Error("Missing messageText");

  // Doc: OTP is messageType=3, Unicode encoding=2
  const payload = {
    apiToken,
    messageType: env("SWIPE_SMS_MESSAGE_TYPE", "3"),
    messageEncoding: env("SWIPE_SMS_ENCODING", "2"),
    destinationAddress,
    sourceAddress,
    messageText,
  };

  const res = await axios.post(url, payload, {
    timeout: 15000,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    validateStatus: () => true,
  });

  if (res.status >= 200 && res.status < 300) {
    return { ok: true, raw: res.data };
  }

  const detail =
    (res.data && (res.data.title || res.data.message || JSON.stringify(res.data))) ||
    `HTTP ${res.status}`;
  const err = new Error(`Swipe SendSmsV2 failed: ${detail}`);
  err.status = res.status;
  err.response = res.data;
  throw err;
}

module.exports = { sendOtpSms };
