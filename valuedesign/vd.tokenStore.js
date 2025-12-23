// server/valuedesign/vd.tokenStore.js
let token = null;
let tokenCreatedAt = null;

exports.setToken = (t) => {
  token = t;
  tokenCreatedAt = new Date();
};

exports.getToken = () => token;

exports.getTokenMeta = () => ({ token, tokenCreatedAt });
