// db/agodaDb.js
const mongoose = require("mongoose");

let agodaConn = null;
let agodaConnPromise = null;

/**
 * Returns a dedicated mongoose connection for Agoda DB ONLY.
 * It never uses process.env.MONGO_URI.
 */
function getAgodaConnection() {
  if (agodaConn) return agodaConn;

  const uri = process.env.MONGO_AGODA_DB_URI;
  if (!uri) {
    throw new Error(
      "MONGO_AGODA_DB_URI is missing. Please set it in .env to connect Agoda DB."
    );
  }

  agodaConn = mongoose.createConnection(uri, {
    // Keep same options style you use elsewhere
    

    // If you want a specific DB name, set it here.
    // If your URI already includes a db name, Mongo will use that.
    dbName: process.env.MONGO_AGODA_DB_NAME || "agoda",
  });

  agodaConn.on("connected", () => {
    console.log("✅ Agoda MongoDB connected successfully!");
    console.log("📂 Agoda DB:", agodaConn.name);
  });

  agodaConn.on("error", (err) => {
    console.error("❌ Agoda MongoDB connection error:", err?.message || err);
  });

  agodaConn.on("disconnected", () => {
    console.warn("⚠️ Agoda MongoDB disconnected");
  });

  return agodaConn;
}

/**
 * Await until the Agoda connection is ready before DB operations.
 * Safe to call multiple times.
 */
async function ensureAgodaConnected() {
  if (agodaConn && agodaConn.readyState === 1) return agodaConn; // connected
  if (!agodaConn) getAgodaConnection();

  // createConnection doesn't return a promise; we can wait on events once.
  if (!agodaConnPromise) {
    agodaConnPromise = new Promise((resolve, reject) => {
      const onConnected = () => {
        cleanup();
        resolve(agodaConn);
      };
      const onError = (err) => {
        cleanup();
        reject(err);
      };
      const cleanup = () => {
        agodaConn.off("connected", onConnected);
        agodaConn.off("error", onError);
      };

      // if already connected quickly
      if (agodaConn.readyState === 1) {
        cleanup();
        return resolve(agodaConn);
      }

      agodaConn.on("connected", onConnected);
      agodaConn.on("error", onError);
    });
  }

  return agodaConnPromise;
}

module.exports = {
  getAgodaConnection,
  ensureAgodaConnected,
};
