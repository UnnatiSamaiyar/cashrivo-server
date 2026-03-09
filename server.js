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

  if (!url) {
    return res.status(400).send("Missing URL");
  }

  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const contentType = response.headers["content-type"];
    res.set("Content-Type", contentType);
    res.send(response.data);
  } catch (error) {
    console.error("Error proxying image:", error.message);
    res.status(500).send("Failed to fetch image");
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
   STARTUP TASKS
----------------------------- */

try {
  startCoupomatedCron();
} catch (err) {
  console.error("❌ Failed to start coupomated cron:", err.message);
}

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