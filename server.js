require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const axios = require("axios");

const { getAgodaConnection } = require("./db/agodaDb");
const authRoutes = require("./routes/authRoutes");
const contactRoutes = require("./routes/contactRoutes");
const advertiseRoutes = require("./routes/advertisementRoutes");
const newsletterRoutes = require("./routes/newsletterRoute");
const currencyRoutes = require("./routes/currencyRoutes");
const linkmydealRoutes = require("./routes/linkmydeal");
const vcommissionRoutes = require("./routes/vcommission");
const affiliatebanner = require("./routes/bannerRoutes");
const couponRoutes = require("./routes/couponRoutes");
const blogsRoutes = require("./routes/blogRoutes");
const impactRoute = require("./routes/impactRoutes");
const previewImagesRoute = require("./utils/previewImages");
const csvcouponRoute = require("./routes/csvcouponRoute");
const flymediaRoute = require("./routes/flymediaRoute");
const cuelinksRoutes = require("./routes/cuelinks");
const amazonRoute = require("./routes/amazonRoute");
const amazonBannerRoute = require("./routes/amazonBannerRoute");
const exclusiveRoute = require("./routes/exclusiveDealRoute");
const involveAsia = require("./routes/involveAsia");
const shopsyRoute = require("./routes/shopsyDealRoute");
const flipkartRoute = require("./routes/flipkartDealRoute");
const ajioRoute = require("./routes/ajioDealRoute");
const lmdCronRoute = require("./routes/linkmydeal");
const agodaRoute = require("./routes/agoda");
const vdRoutes = require("./valuedesign/vd.routes");
const giftcardRoutes = require("./routes/giftcards");
const earnkaroRoute = require("./routes/earnKaroRoute");
const { startCoupomatedCron } = require("./cron/coupomatedCron");
const razorpayRoutes = require("./routes/razorpay");
const searchRoutes = require("./routes/searchRoutes");
const launchpadRoutes = require("./routes/launchpadRoutes");
const rivoPointsRoutes = require("./routes/rivoPoints");
const seoSettingsRoutes = require("./routes/seoSettingsRoutes");
const policyRoutes = require("./routes/policyRoutes");
const ecouponRoutes = require("./routes/ecouponRoutes");
const corporateInquiryRoute = require("./routes/corporateInquiry.routes");

require("./cron/fetchScheduler");

const app = express();

/* -----------------------------
   CORS CONFIG
----------------------------- */

const allowedOrigins = [
  "https://cashrivo.com",
  "https://www.cashrivo.com",
  "https://app.cashrivo.com",
  "http://localhost:5173",
  "http://localhost:5174",
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow non-browser requests like mobile apps, Postman, curl, server-to-server
    if (!origin) {
      return callback(null, true);
    }

    // Exact whitelist
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow Flutter web / local dev with random localhost ports
    if (
      /^http:\/\/localhost:\d+$/.test(origin) ||
      /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)
    ) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

/* -----------------------------
   BODY PARSERS
----------------------------- */

app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ extended: true, limit: "200mb" }));

/* -----------------------------
   BASIC HEALTH ROUTE
----------------------------- */

app.get("/", (req, res) => {
  res.send("Backend working!");
});

/* -----------------------------
   STATIC FILES
----------------------------- */

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* -----------------------------
   IMAGE PROXY
----------------------------- */

app.get("/proxy-logo", async (req, res) => {
  const { url } = req.query;

  if (!url || typeof url !== "string") {
    return res.status(400).send("Missing URL");
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).send("Invalid URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return res.status(400).send("Unsupported protocol");
  }

  try {
    const response = await axios.get(parsed.toString(), {
      responseType: "stream",
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        Referer: "https://cashrivo.com/",
      },
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const contentType = response.headers["content-type"] || "image/jpeg";
    const cacheControl =
      response.headers["cache-control"] || "public, max-age=86400";

    res.set("Content-Type", contentType);
    res.set("Cache-Control", cacheControl);
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Cross-Origin-Resource-Policy", "cross-origin");

    response.data.pipe(res);
  } catch (error) {
    console.error(
      "Error proxying image:",
      parsed.toString(),
      error.response?.status || error.message
    );
    res.status(502).send("Failed to fetch image");
  }
});

/* -----------------------------
   API ROUTES
----------------------------- */

app.use("/api/auth", authRoutes);
app.use("/api", contactRoutes);
app.use("/api", advertiseRoutes);
app.use("/api", newsletterRoutes);
app.use("/api", currencyRoutes);
app.use("/api", linkmydealRoutes);
app.use("/api", vcommissionRoutes);
app.use("/api", affiliatebanner);
app.use("/api", couponRoutes);
app.use("/api", blogsRoutes);
app.use("/api", impactRoute);
app.use("/preview-images", previewImagesRoute);
app.use("/api", csvcouponRoute);
app.use("/api", flymediaRoute);
app.use("/api", cuelinksRoutes);
app.use("/api", amazonRoute);
app.use("/api", amazonBannerRoute);
app.use("/api", exclusiveRoute);
app.use("/api", involveAsia);
app.use("/api", flipkartRoute);
app.use("/api", shopsyRoute);
app.use("/api", ajioRoute);
app.use("/api", lmdCronRoute);
app.use("/api", agodaRoute);
app.use("/api/vd", vdRoutes);
app.use("/api/giftcards", giftcardRoutes);
app.use("/api/earnkaro", earnkaroRoute);
app.use("/api/razorpay", razorpayRoutes);
app.use("/api", searchRoutes);
app.use("/api/launchpad", launchpadRoutes);
app.use("/api", seoSettingsRoutes);
app.use("/api", policyRoutes);
app.use("/api", ecouponRoutes);
app.use("/api", corporateInquiryRoute);

// Rivo Points
app.use("/api/rivo", rivoPointsRoutes);

/* -----------------------------
   ADMIN ROUTES
----------------------------- */

const adminAuthRoutes = require("./admin/routes/auth");
const adminUserRoutes = require("./admin/routes/users");
const adminWebsiteRoutes = require("./admin/routes/websites");

app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin", adminUserRoutes);
app.use("/api/admin", adminWebsiteRoutes);

/* -----------------------------
   APP ROUTES
----------------------------- */
const cuelinkAppRoutes = require("./routes/app/cuelinksapp");
const launchpadAppRoutes = require("./routes/app/launchpadapp");



app.use("/api", cuelinkAppRoutes);
app.use("/api", launchpadAppRoutes);

/* -----------------------------
   STARTUP TASKS
----------------------------- */

try {
  getAgodaConnection();
} catch (err) {
  console.error("❌ Agoda DB connection failed:", err.message);
}

/* -----------------------------
   MONGODB + SERVER START
----------------------------- */

mongoose
  .connect(process.env.MONGO_URI, {
    dbName: "test",
  })
  .then(() => {
    console.log("✅ MongoDB connected successfully!");
    console.log("📂 Using database:", mongoose.connection.db.databaseName);

    app.listen(process.env.PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on http://0.0.0.0:${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ DB connection failed:", err);
  });