const cron = require("node-cron");
const { syncNew, syncUpdated } = require("../services/couponmatedServices");

const TZ = "Asia/Kolkata";

function safeRun(name, fn) {
  return async () => {
    try {
      const r = await fn();
      console.log(`[CRON:${name}]`, r);
    } catch (e) {
      console.error(`[CRON:${name}] FAILED`, e?.message || e);
    }
  };
}

function startCoupomatedCron() {
  // NEW: 10 times a day
  // minute hour day month weekday
  cron.schedule("7 0,2,4,6,8,10,12,14,16,18 * * *", safeRun("NEW", syncNew), { timezone: TZ });

  // UPDATED: 5 times a day
  cron.schedule("17 1,6,11,16,21 * * *", safeRun("UPDATED", syncUpdated), { timezone: TZ });

  console.log("✅ Coupomated cron scheduled (Asia/Kolkata).");
}

module.exports = { startCoupomatedCron };
