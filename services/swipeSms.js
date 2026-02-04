
"use strict";
const axios = require("axios");

const SWIPE_DOMAIN = process.env.SWIPE_DOMAIN;
const API_TOKEN = process.env.SWIPE_API_TOKEN;
const SOURCE = process.env.SWIPE_SOURCE_ADDRESS || "CASHRV";
const COUNTRY = process.env.SWIPE_DEST_COUNTRY_CODE || "91";

async function sendOtp({ phone, message }) {
  const url = `${SWIPE_DOMAIN}/SendSmsV2`;
  const payload = {
    apiToken: API_TOKEN,
    sourceAddress: SOURCE,
    message,
    destination: `${COUNTRY}${phone.replace(/\D/g, "")}`,
  };
  const res = await axios.post(url, payload, { timeout: 15000 });
  return res.data;
}

module.exports = { sendOtp };
