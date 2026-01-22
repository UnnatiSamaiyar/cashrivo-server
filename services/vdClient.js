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
  const res = await axios.post(url, body, { headers, timeout });
  return res.data;
}

module.exports = { assertUrl, vdPost };
