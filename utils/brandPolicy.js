// utils/brandPolicy.js

/**
 * Brand compliance policies for Amazon / Flipkart.
 * Keep logic server-side to avoid bypass.
 */

function norm(s) {
  return String(s || "").trim().toLowerCase();
}

function detectBrandKey({ brandName, brandCode }) {
  const name = norm(brandName);
  const code = norm(brandCode);

  const isAmazon = name.includes("amazon") || code.includes("amazon");
  if (isAmazon && (name.includes("pay") || code.includes("pay"))) return "AMAZON";
  if (isAmazon && (name.includes("shopping") || code.includes("shopping"))) return "AMAZON";

  if (name.includes("flipkart") || code.includes("flipkart")) return "FLIPKART";
  return "NORMAL";
}

function policyFor(brandKey) {
  if (brandKey === "AMAZON") {
    return {
      brandKey,
      upiOnly: true,
      // ₹10,000 per month per customer
      monthlySpendCapPaise: 10000 * 100,
      // no discounts to end customers
      maxDiscountPercent: 0,
      monthlyDiscountCapPaise: 0,
    };
  }
  if (brandKey === "FLIPKART") {
    return {
      brandKey,
      upiOnly: true,
      // ₹50,000 per month per user
      monthlySpendCapPaise: 50000 * 100,
      // max 1.25% discount
      maxDiscountPercent: 1.25,
      // ₹625 per month discount cap
      monthlyDiscountCapPaise: 625 * 100,
    };
  }
  return {
    brandKey: "NORMAL",
    upiOnly: false,
    monthlySpendCapPaise: 0,
    maxDiscountPercent: null,
    monthlyDiscountCapPaise: 0,
  };
}

function monthKeyUtc(d = new Date()) {
  return new Date(d).toISOString().slice(0, 7); // YYYY-MM
}

module.exports = {
  detectBrandKey,
  policyFor,
  monthKeyUtc,
};
