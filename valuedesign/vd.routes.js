    import express from "express";
import * as c from "./vd.controller.js";

const r = express.Router();

// protect admin endpoints
r.use((req, res, next) => {
  if (req.headers["x-admin-key"] !== process.env.ADMIN_PROXY_KEY) return res.status(403).json({ error: "forbidden" });
  next();
});

r.post("/token/generate", c.generateToken);
r.post("/brand", c.getBrand);
r.post("/store", c.getStore);
r.post("/evc", c.getEvc);
r.post("/evc/status", c.getEvcStatus);
r.post("/evc/activated", c.getActivatedEvc);
r.post("/wallet", c.getWallet);

export default r;
