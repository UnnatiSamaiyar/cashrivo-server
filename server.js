require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const axios = require('axios');

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
const impactRoute = require('./routes/impactRoutes');
const previewImagesRoute = require('./utils/previewImages');
const csvcouponRoute = require('./routes/csvcouponRoute');
const flymediaRoute = require('./routes/flymediaRoute')


require('./cron/fetchScheduler');

const app = express();

const allowedOrigins = [
  "https://cashrivo.com",
  "http://localhost:5173",
  "http://localhost:5174"
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));



app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get('/proxy-logo', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send("Missing URL");

  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const contentType = response.headers['content-type'];
    res.set('Content-Type', contentType);
    res.send(response.data);
  } catch (error) {
    console.error("Error proxying image:", error.message);
    res.status(500).send("Failed to fetch image");
  }
});


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
app.use('/preview-images', previewImagesRoute);
app.use("/api", csvcouponRoute);
app.use("/api", flymediaRoute)

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    app.listen(process.env.PORT, () =>
      console.log(`Server running on http://localhost:${process.env.PORT}`)
    );
  })
  .catch((err) => console.error("DB connection failed", err));
