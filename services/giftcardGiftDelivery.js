// services/giftcardGiftDelivery.js
"use strict";

const { sendMail } = require("./mailer");

function clean(value, max = 1000) {
  return String(value || "").trim().slice(0, max);
}

function escapeHtml(value) {
  return clean(value, 5000)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatRupees(value) {
  const n = Number(value || 0);
  return `₹${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

function formatDate(value) {
  if (!value) return "";
  const s = clean(value, 80);
  return s;
}

function getVoucherList(vouchers) {
  if (!vouchers) return [];

  const root = vouchers;
  const list = Array.isArray(root)
    ? root
    : Array.isArray(root?.items)
      ? root.items
      : Array.isArray(root?.cards)
        ? root.cards
        : Array.isArray(root?.CardDetails)
          ? root.CardDetails
          : Array.isArray(root?.card_details)
            ? root.card_details
            : Array.isArray(root?.brand_details?.[0]?.items)
              ? root.brand_details[0].items
              : null;

  if (Array.isArray(list)) return list.filter(Boolean);
  if (root && typeof root === "object") return [root];
  return [];
}

function normalizeVoucher(item = {}, fallback = {}) {
  const code = clean(
    item.getCardNo ||
      item.card_no ||
      item.CardNo ||
      item.code ||
      item.voucher_no ||
      item.voucherCode ||
      item.cardNumber ||
      "",
    180,
  );

  const pin = clean(
    item.getCardPin ||
      item.pin ||
      item.CardPin ||
      item.voucher_pin ||
      item.voucherPin ||
      item.cardPin ||
      "",
    120,
  );

  const expiry = formatDate(
    item.getExpiryDate ||
      item.expiry ||
      item.Expiry ||
      item.valid_till ||
      item.validTill ||
      item.validity ||
      "",
  );

  const amount = clean(
    item.balanceTotal ||
      item.amount ||
      item.Amount ||
      fallback.amount ||
      "",
    80,
  );

  return { code, pin, expiry, amount };
}

function maskCode(code) {
  const s = clean(code, 180);
  if (!s) return "Gift card ready";
  if (s.length <= 4) return `•••• ${s}`;
  return `•••• ${s.slice(-4)}`;
}

function buildVoucherRows({ vouchers, fallbackAmount, revealFull = false }) {
  const list = getVoucherList(vouchers).map((item) => normalizeVoucher(item, { amount: fallbackAmount }));

  if (!list.length) {
    return `<tr><td colspan="4" style="padding:12px;border:1px solid #e5e7eb;color:#475569;">Gift card details are ready.</td></tr>`;
  }

  return list
    .map((item, index) => {
      const visibleCode = revealFull ? item.code || "-" : maskCode(item.code);
      const visiblePin = revealFull ? item.pin || "-" : item.pin ? "••••" : "-";
      return `
        <tr>
          <td style="padding:12px;border:1px solid #e5e7eb;">${index + 1}</td>
          <td style="padding:12px;border:1px solid #e5e7eb;font-family:Consolas,Monaco,monospace;word-break:break-all;">${escapeHtml(visibleCode)}</td>
          <td style="padding:12px;border:1px solid #e5e7eb;font-family:Consolas,Monaco,monospace;word-break:break-all;">${escapeHtml(visiblePin)}</td>
          <td style="padding:12px;border:1px solid #e5e7eb;">${escapeHtml(item.expiry || "-")}</td>
        </tr>`;
    })
    .join("");
}

function buildVoucherText({ vouchers, fallbackAmount, revealFull = false }) {
  const list = getVoucherList(vouchers).map((item) => normalizeVoucher(item, { amount: fallbackAmount }));
  if (!list.length) return "Gift card details are ready.";

  return list
    .map((item, index) => {
      const visibleCode = revealFull ? item.code || "-" : maskCode(item.code);
      const visiblePin = revealFull ? item.pin || "-" : item.pin ? "****" : "-";
      return [
        `Card ${index + 1}`,
        `Code: ${visibleCode}`,
        `PIN: ${visiblePin}`,
        `Expiry: ${item.expiry || "-"}`,
      ].join("\n");
    })
    .join("\n\n");
}

function baseShell({ title, subtitle, body }) {
  return `
  <div style="margin:0;background:#f8fafc;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;box-shadow:0 18px 50px rgba(15,23,42,0.08);">
      <div style="padding:22px 24px;background:#0b1220;color:#ffffff;">
        <div style="font-size:20px;font-weight:800;line-height:1.3;">${escapeHtml(title)}</div>
        ${subtitle ? `<div style="font-size:14px;opacity:.86;margin-top:6px;line-height:1.5;">${escapeHtml(subtitle)}</div>` : ""}
      </div>
      <div style="padding:24px;">${body}</div>
      <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e5e7eb;font-size:12px;color:#64748b;line-height:1.5;">
        This email was sent by Cashrivo. Please keep your voucher code and PIN private.
      </div>
    </div>
  </div>`;
}

function buildSummaryTable({ purchase, includeRecipient = false }) {
  const recipient = purchase?.recipient || {};
  const rows = [
    ["Brand", purchase?.brandName || purchase?.brandCode || "Gift Card"],
    ["Amount", formatRupees(purchase?.amount)],
    ["Quantity", String(purchase?.qty || 1)],
    ["Total paid", formatRupees(purchase?.totalAmount)],
    ["Order ID", String(purchase?._id || "")],
  ];

  if (includeRecipient) {
    rows.push(["Recipient", recipient?.name || ""]);
    rows.push(["Recipient email", recipient?.email || ""]);
    rows.push(["Recipient phone", recipient?.mobile || ""]);
  }

  return `
    <table style="width:100%;border-collapse:collapse;margin:0 0 18px 0;font-size:14px;">
      ${rows
        .map(
          ([label, value]) => `
          <tr>
            <td style="padding:10px 12px;border:1px solid #e5e7eb;background:#f8fafc;color:#475569;width:38%;">${escapeHtml(label)}</td>
            <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:700;color:#0f172a;">${escapeHtml(value)}</td>
          </tr>`,
        )
        .join("")}
    </table>`;
}

function buildVoucherTable({ vouchers, fallbackAmount, revealFull }) {
  return `
    <div style="margin-top:16px;">
      <div style="font-weight:800;font-size:15px;margin-bottom:10px;color:#0f172a;">Voucher details</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr>
            <th align="left" style="padding:10px;border:1px solid #e5e7eb;background:#f1f5f9;">#</th>
            <th align="left" style="padding:10px;border:1px solid #e5e7eb;background:#f1f5f9;">Code</th>
            <th align="left" style="padding:10px;border:1px solid #e5e7eb;background:#f1f5f9;">PIN</th>
            <th align="left" style="padding:10px;border:1px solid #e5e7eb;background:#f1f5f9;">Expiry</th>
          </tr>
        </thead>
        <tbody>${buildVoucherRows({ vouchers, fallbackAmount, revealFull })}</tbody>
      </table>
    </div>`;
}

function buildBuyerEmail({ purchase, vouchers, isTest = false }) {
  const isGift = String(purchase?.purchase_type || "SELF").toUpperCase() === "GIFT";
  const brandName = purchase?.brandName || purchase?.brandCode || "Gift Card";
  const title = "Your gift card purchase was successful";
  const subtitle = isGift
    ? `Your ${brandName} gift card has been prepared for ${purchase?.recipient?.name || "the recipient"}.`
    : `Your ${brandName} gift card is ready.`;

  const body = `
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">Hi ${escapeHtml(purchase?.buyer?.name || "there")},</p>
    <p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;color:#334155;">
      ${isGift ? "Your gift card purchase was successful. Voucher details are below, and the recipient will receive a separate gift email." : "Your gift card purchase was successful. Your redeem details are below."}
    </p>
    ${buildSummaryTable({ purchase, includeRecipient: isGift })}
    ${buildVoucherTable({ vouchers, fallbackAmount: purchase?.amount, revealFull: true })}
    ${isTest ? `<p style="margin:14px 0 0 0;font-size:12px;color:#b45309;">Test mode voucher generated for internal testing.</p>` : ""}
  `;

  return {
    subject: `${isGift ? "Gift card sent successfully" : "Your Cashrivo Gift Card"} - ${brandName}`,
    html: baseShell({ title, subtitle, body }),
    text: [
      title,
      subtitle,
      `Brand: ${brandName}`,
      `Amount: ${formatRupees(purchase?.amount)}`,
      `Quantity: ${purchase?.qty || 1}`,
      `Total paid: ${formatRupees(purchase?.totalAmount)}`,
      isGift ? `Recipient: ${purchase?.recipient?.name || ""} (${purchase?.recipient?.email || ""}, ${purchase?.recipient?.mobile || ""})` : "",
      buildVoucherText({ vouchers, fallbackAmount: purchase?.amount, revealFull: true }),
    ].filter(Boolean).join("\n"),
  };
}

function buildRecipientEmail({ purchase, vouchers, isTest = false }) {
  const brandName = purchase?.brandName || purchase?.brandCode || "Gift Card";
  const buyerName = purchase?.buyer?.name || "Someone";
  const recipientName = purchase?.recipient?.name || "there";

  const body = `
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">Hi ${escapeHtml(recipientName)},</p>
    <p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;color:#334155;">
      You received a ${escapeHtml(brandName)} gift card from <b>${escapeHtml(buyerName)}</b>.
    </p>
    ${buildSummaryTable({ purchase, includeRecipient: false })}
    ${buildVoucherTable({ vouchers, fallbackAmount: purchase?.amount, revealFull: true })}
    <div style="margin-top:18px;padding:14px;border:1px solid #dbeafe;background:#eff6ff;border-radius:14px;color:#1e3a8a;font-size:14px;line-height:1.6;">
      <b>How to redeem</b><br />
      1. Open the brand website, app, or store checkout.<br />
      2. Choose gift card/voucher as the payment option where available.<br />
      3. Enter the voucher code and PIN shown above.<br />
      4. Please check the brand's terms and validity before use.
    </div>
    ${isTest ? `<p style="margin:14px 0 0 0;font-size:12px;color:#b45309;">Test mode voucher generated for internal testing.</p>` : ""}
  `;

  return {
    subject: `You received a ${brandName} gift card`,
    html: baseShell({
      title: `You received a gift card from ${buyerName}`,
      subtitle: `${brandName} gift card redeem details are inside.`,
      body,
    }),
    text: [
      `Hi ${recipientName},`,
      `You received a ${brandName} gift card from ${buyerName}.`,
      `Amount: ${formatRupees(purchase?.amount)}`,
      `Quantity: ${purchase?.qty || 1}`,
      buildVoucherText({ vouchers, fallbackAmount: purchase?.amount, revealFull: true }),
      "How to redeem: Use the voucher code and PIN on the brand website, app, or store checkout where gift card redemption is supported. Check brand terms and validity before use.",
    ].join("\n"),
  };
}

async function trySendMail({ to, subject, html, text }) {
  const safeTo = clean(to, 180).toLowerCase();
  if (!safeTo) {
    return {
      sent: false,
      to: "",
      messageId: "",
      error: "Recipient email missing",
      sentAt: null,
    };
  }

  try {
    const info = await sendMail({ to: safeTo, subject, html, text });
    return {
      sent: true,
      to: safeTo,
      messageId: String(info?.messageId || ""),
      error: "",
      sentAt: new Date(),
    };
  } catch (error) {
    return {
      sent: false,
      to: safeTo,
      messageId: "",
      error: String(error?.message || error),
      sentAt: null,
    };
  }
}

async function sendGiftcardSuccessEmails({ purchase, buyerEmail, vouchers, isTest = false }) {
  const buyerTemplate = buildBuyerEmail({ purchase, vouchers, isTest });
  const buyer = await trySendMail({
    to: buyerEmail || purchase?.buyer?.email,
    subject: buyerTemplate.subject,
    html: buyerTemplate.html,
    text: buyerTemplate.text,
  });

  let recipient = {
    sent: false,
    to: "",
    messageId: "",
    error: "NOT_REQUIRED",
    sentAt: null,
  };

  if (String(purchase?.purchase_type || "SELF").toUpperCase() === "GIFT") {
    const recipientTemplate = buildRecipientEmail({ purchase, vouchers, isTest });
    recipient = await trySendMail({
      to: purchase?.recipient?.email,
      subject: recipientTemplate.subject,
      html: recipientTemplate.html,
      text: recipientTemplate.text,
    });
  }

  return { buyer, recipient };
}

module.exports = {
  sendGiftcardSuccessEmails,
  buildBuyerEmail,
  buildRecipientEmail,
};
