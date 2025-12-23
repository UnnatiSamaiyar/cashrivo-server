import * as vd from "./vd.client.js";

export const generateToken = async (req, res) => res.json(await vd.generateToken());
export const getBrand = async (req, res) => res.json(await vd.getBrand(req.body.BrandCode || ""));
export const getStore = async (req, res) => res.json(await vd.getStore(req.body.BrandCode || ""));
export const getEvc = async (req, res) => res.json(await vd.getEvc(req.body));
export const getEvcStatus = async (req, res) => res.json(await vd.getEvcStatus(req.body.order_id, req.body.request_ref_no));
export const getActivatedEvc = async (req, res) => res.json(await vd.getActivatedEvc(req.body.order_id, req.body.request_ref_no));
export const getWallet = async (req, res) => res.json(await vd.getWalletBalance());
