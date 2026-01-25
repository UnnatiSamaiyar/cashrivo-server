// services/vdClient.js
const axios = require("axios");

function assertUrl(url, name) {
  if (!url) {
    const err = new Error(`${name} URL missing. Set VD_BASE or ${name} env URL.`);
    err.statusCode = 500;
    throw err;
  }
}

async function vdPost(url, body, headers = {}, timeout = 20000) {
  const res = await axios.post(url, body, {
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    timeout,
    validateStatus: () => true, // handle non-2xx as data too (VD sometimes)
  });

  // Normalize: always return response body (even on 4xx/5xx)
  return res.data;
}

module.exports = { assertUrl, vdPost };
