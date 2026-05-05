const express = require("express");
const nodemailer = require("nodemailer");
const CorporateInquiry = require("../models/CorporateInquiry");

const router = express.Router();

const CORPORATE_USE_CASES = [
  "Employee Gifting",
  "Employee R&R",
  "Employee Sales Incentive",
  "Employee Dealer Program",
  "Marketing & Promotion",
  "Others",
];

const RECIPIENTS = ["connect@cashrivo.com", "marketing@grapewish.com", "unnati@grapewish.com"];
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function validatePayload(body) {
  const payload = {
    companyName: clean(body.companyName),
    firstName: clean(body.firstName),
    lastName: clean(body.lastName),
    corporateEmail: clean(body.corporateEmail).toLowerCase(),
    phoneNumber: clean(body.phoneNumber),
    location: clean(body.location),
    useCase: clean(body.useCase),
    otherRequirement: clean(body.otherRequirement),
  };

  const errors = {};

  if (!payload.companyName) errors.companyName = "Company name is required.";
  if (!payload.firstName) errors.firstName = "First name is required.";
  if (!payload.lastName) errors.lastName = "Last name is required.";

  if (!payload.corporateEmail) {
    errors.corporateEmail = "Corporate email is required.";
  } else if (!emailRegex.test(payload.corporateEmail)) {
    errors.corporateEmail = "Enter a valid corporate email.";
  }

  if (!payload.phoneNumber) {
    errors.phoneNumber = "Phone number is required.";
  } else if (payload.phoneNumber.replace(/[^\d]/g, "").length < 10) {
    errors.phoneNumber = "Enter a valid phone number.";
  }

  if (!payload.useCase) {
    errors.useCase = "Use case is required.";
  } else if (!CORPORATE_USE_CASES.includes(payload.useCase)) {
    errors.useCase = "Invalid use case selected.";
  }

  if (payload.useCase === "Others" && !payload.otherRequirement) {
    errors.otherRequirement = "Please specify your requirement.";
  }

  return { payload, errors };
}

function getTransporter() {
  const port = Number(process.env.SMTP_PORT || 465);

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function buildMail(inquiry) {
  const fullName = `${inquiry.firstName} ${inquiry.lastName}`.trim();
  const subject = `New Corporate Gift Card Enquiry - ${inquiry.companyName}`;

  const html = `
    <div style="margin:0;padding:0;background:#f6f9fc;font-family:Arial,Helvetica,sans-serif;color:#102a43;">
      <div style="max-width:680px;margin:0 auto;padding:28px 16px;">
        <div style="background:#ffffff;border:1px solid #e6ecf4;border-radius:18px;overflow:hidden;box-shadow:0 20px 50px rgba(15,49,88,0.08);">
          <div style="background:linear-gradient(90deg,#27348A,#C779D0,#27348A);padding:24px 28px;color:#ffffff;">
            <h1 style="margin:0;font-size:22px;line-height:1.3;">New Corporate Gift Card Enquiry</h1>
            <p style="margin:8px 0 0;font-size:14px;opacity:0.9;">Submitted from Cashrivo Corporate Orders Page</p>
          </div>

          <div style="padding:26px 28px;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tbody>
                <tr>
                  <td style="padding:10px 0;color:#64748b;width:190px;">Company Name</td>
                  <td style="padding:10px 0;font-weight:700;">${escapeHtml(inquiry.companyName)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;color:#64748b;">Concerned Person</td>
                  <td style="padding:10px 0;font-weight:700;">${escapeHtml(fullName)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;color:#64748b;">Corporate Email</td>
                  <td style="padding:10px 0;font-weight:700;">${escapeHtml(inquiry.corporateEmail)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;color:#64748b;">Phone Number</td>
                  <td style="padding:10px 0;font-weight:700;">${escapeHtml(inquiry.phoneNumber)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;color:#64748b;">Location</td>
                  <td style="padding:10px 0;font-weight:700;">${escapeHtml(inquiry.location || "Not provided")}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;color:#64748b;">Use Case</td>
                  <td style="padding:10px 0;font-weight:700;">${escapeHtml(inquiry.useCase)}</td>
                </tr>
                ${
                  inquiry.useCase === "Others"
                    ? `<tr>
                        <td style="padding:10px 0;color:#64748b;vertical-align:top;">Other Requirement</td>
                        <td style="padding:10px 0;font-weight:700;white-space:pre-wrap;">${escapeHtml(inquiry.otherRequirement)}</td>
                      </tr>`
                    : ""
                }
              </tbody>
            </table>

            <div style="margin-top:24px;padding:14px 16px;border-radius:12px;background:#f8fafc;border:1px solid #e6ecf4;color:#475569;font-size:13px;">
              Enquiry ID: ${escapeHtml(String(inquiry._id))}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const text = [
    "New Corporate Gift Card Enquiry",
    "",
    `Company Name: ${inquiry.companyName}`,
    `Concerned Person: ${fullName}`,
    `Corporate Email: ${inquiry.corporateEmail}`,
    `Phone Number: ${inquiry.phoneNumber}`,
    `Location: ${inquiry.location || "Not provided"}`,
    `Use Case: ${inquiry.useCase}`,
    inquiry.useCase === "Others" ? `Other Requirement: ${inquiry.otherRequirement}` : "",
    "",
    `Enquiry ID: ${inquiry._id}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

router.post("/corporate-orders", async (req, res) => {
  try {
    const { payload, errors } = validatePayload(req.body || {});

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors,
      });
    }

    const inquiry = await CorporateInquiry.create({
      ...payload,
      ipAddress: req.ip || "",
      userAgent: req.get("user-agent") || "",
      mailStatus: "pending",
    });

    try {
      const transporter = getTransporter();
      const mail = buildMail(inquiry);

      await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: RECIPIENTS.join(","),
        replyTo: inquiry.corporateEmail,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });

      inquiry.mailStatus = "sent";
      inquiry.mailError = "";
      await inquiry.save();

      return res.status(201).json({
        success: true,
        message: "Corporate enquiry submitted successfully.",
        inquiryId: inquiry._id,
      });
    } catch (mailError) {
      inquiry.mailStatus = "failed";
      inquiry.mailError = mailError instanceof Error ? mailError.message : "Mail sending failed.";
      await inquiry.save();

      return res.status(502).json({
        success: false,
        message: "Enquiry saved, but email notification failed. Please check SMTP configuration.",
        inquiryId: inquiry._id,
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to submit enquiry right now.",
    });
  }
});

module.exports = router;
