const express = require("express");
const router = express.Router();

router.get("/public", (req, res) => res.json({ ok: true }));
router.get("/admin", (req, res) => res.json({ ok: true }));
router.put("/admin", (req, res) => res.json({ ok: true }));

module.exports = router; // ✅
