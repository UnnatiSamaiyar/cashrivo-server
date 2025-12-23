let token = null;
let tokenCreatedAt = null;

export function setToken(t) {
  token = t;
  tokenCreatedAt = new Date();
}
export function getToken() {
  return token;
}
export function getTokenMeta() {
  return { token, tokenCreatedAt };
}
