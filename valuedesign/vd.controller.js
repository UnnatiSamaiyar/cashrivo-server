// server/valuedesign/vd.controller.js
const vd = require("./vd.client");

exports.generateToken = async (req, res) => res.json(await vd.generateToken());
exports.getBrand = async (req, res) => res.json(await vd.getBrand(req.body.BrandCode || ""));
exports.getStore = async (req, res) => res.json(await vd.getStore(req.body.BrandCode || ""));
exports.getEvc = async (req, res) => res.json(await vd.getEvc(req.body));
exports.getEvcStatus = async (req, res) =>
  res.json(await vd.getEvcStatus(req.body.order_id, req.body.request_ref_no));
exports.getActivatedEvc = async (req, res) =>
  res.json(await vd.getActivatedEvc(req.body.order_id, req.body.request_ref_no));
exports.getWallet = async (req, res) => res.json(await vd.getWalletBalance());
