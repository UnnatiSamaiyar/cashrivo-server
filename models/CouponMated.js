const mongoose = require("mongoose");

function parseDMYToDate(dmy) {
  // expects "DD-MM-YYYY" (as in your sample)
  if (!dmy || typeof dmy !== "string") return null;
  const [dd, mm, yyyy] = dmy.split("-").map((x) => parseInt(x, 10));
  if (!dd || !mm || !yyyy) return null;
  const dt = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

const CouponMatedSchema = new mongoose.Schema(
  {
    // provider metadata
    source: { type: String, default: "coupomated", index: true },

    // stable unique identifier from provider
    providerCouponId: { type: String, required: true, index: true, unique: true },

    // fields from API
    title: String,
    description: String,
    discount: String,
    coupon_code: { type: String, default: null },

    network_id: { type: String, default: null },
    plain_link: String,
    affiliate_link: String,

    merchant_id: String,
    merchant_name: String,
    merchant_logo: String,

    exclusive: { type: String, default: "0" }, // comes as "0"/"1"
    user_type: String,

    start_date_raw: { type: String, default: null },
    end_date_raw: { type: String, default: null },
    created_at_raw: { type: String, default: null },
    updated_at_raw: { type: String, default: null },
    verified_at_raw: { type: String, default: null },

    start_date: { type: Date, default: null },
    end_date: { type: Date, default: null },
    created_at: { type: Date, default: null },
    updated_at: { type: Date, default: null },
    verified_at: { type: Date, default: null },

    category_names: { type: [String], default: [] },
    category_ids: { type: [Number], default: [] },
    category_names_list: { type: String, default: "" },

    tag_names: { type: [String], default: [] },
    tag_ids: { type: [Number], default: [] },

    brand_names: { type: [String], default: [] },
    brand_ids: { type: [Number], default: [] },

    payment_mode_names: { type: [String], default: [] },
    payment_mode_ids: { type: [Number], default: [] },

    // raw payload (optional but useful for debugging)
    raw: { type: Object, default: {} },

    // sync metadata
    lastSyncedAt: { type: Date, default: null, index: true },
    lastSyncType: { type: String, default: null }, // "all" | "new" | "updated"
  },
  { timestamps: true }
);

// helper to normalize one API object into DB doc shape
CouponMatedSchema.statics.fromCoupomated = function fromCoupomated(item) {
  const providerCouponId = String(item.coupon_id ?? item.id ?? "");

  return {
    source: "coupomated",
    providerCouponId,

    title: item.title ?? "",
    description: item.description ?? "",
    discount: item.discount ?? "",
    coupon_code: item.coupon_code ?? null,

    network_id: item.network_id ?? null,
    plain_link: item.plain_link ?? "",
    affiliate_link: item.affiliate_link ?? "",

    merchant_id: item.merchant_id ?? "",
    merchant_name: item.merchant_name ?? "",
    merchant_logo: item.merchant_logo ?? "",

    exclusive: item.exclusive ?? "0",
    user_type: item.user_type ?? "",

    start_date_raw: item.start_date ?? null,
    end_date_raw: item.end_date ?? null,
    created_at_raw: item.created_at ?? null,
    updated_at_raw: item.updated_at ?? null,
    verified_at_raw: item.verified_at ?? null,

    start_date: parseDMYToDate(item.start_date),
    end_date: parseDMYToDate(item.end_date),
    created_at: parseDMYToDate(item.created_at),
    updated_at: parseDMYToDate(item.updated_at),
    verified_at: parseDMYToDate(item.verified_at),

    category_names: Array.isArray(item.category_names) ? item.category_names : [],
    category_ids: Array.isArray(item.category_ids) ? item.category_ids : [],
    category_names_list: item.category_names_list ?? "",

    tag_names: Array.isArray(item.tag_names) ? item.tag_names : [],
    tag_ids: Array.isArray(item.tag_ids) ? item.tag_ids : [],

    brand_names: Array.isArray(item.brand_names) ? item.brand_names : [],
    brand_ids: Array.isArray(item.brand_ids) ? item.brand_ids : [],

    payment_mode_names: Array.isArray(item.payment_mode_names) ? item.payment_mode_names : [],
    payment_mode_ids: Array.isArray(item.payment_mode_ids) ? item.payment_mode_ids : [],

    raw: item,
  };
};

module.exports = mongoose.model("CouponMated", CouponMatedSchema);
