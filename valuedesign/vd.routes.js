// server/valuedesign/vd.routes.js
const express = require("express");
const c = require("./vd.controller");

const router = express.Router();

// protect admin endpoints
router.use((req, res, next) => {
  if (req.headers["x-admin-key"] !== process.env.ADMIN_PROXY_KEY) {
    return res.status(403).json({ error: "forbidden" });
  }
  next();
});

router.post("/token/generate", c.generateToken);
router.post("/brand", c.getBrand);
router.post("/store", c.getStore);
router.post("/evc", c.getEvc);
router.post("/evc/status", c.getEvcStatus);
router.post("/evc/activated", c.getActivatedEvc);
router.post("/wallet", c.getWallet);

module.exports = router;
