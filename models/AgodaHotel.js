// models/AgodaHotel.js
const mongoose = require("mongoose");
const { getAgodaConnection } = require("../db/agodaDb");

const AgodaHotelSchema = new mongoose.Schema(
  {
    cityId: { type: Number, index: true },
    hotelId: { type: Number, index: true },

    hotelName: { type: String, index: true },
    starRating: { type: Number, index: true },
    reviewScore: { type: Number, index: true },
    reviewCount: { type: Number },

    currency: { type: String },
    dailyRate: { type: Number, index: true },
    crossedOutRate: { type: Number },
    discountPercentage: { type: Number },

    imageURL: { type: String },
    landingURL: { type: String },

    includeBreakfast: { type: Boolean, default: false },
    freeWifi: { type: Boolean, default: false, index: true },

    latitude: { type: Number, index: true },
    longitude: { type: Number, index: true },

    raw: { type: Object },

    lastFetchedAt: { type: Date, index: true },
    createdAt: { type: Date, default: Date.now },
  },
  {
    // You are already setting createdAt manually in upsert;
    // keep timestamps off to avoid conflict.
    timestamps: false,
  }
);

// Unique constraint: one hotel per city
AgodaHotelSchema.index({ cityId: 1, hotelId: 1 }, { unique: true });

/**
 * IMPORTANT:
 * Use Agoda-specific connection ONLY (MONGO_AGODA_DB_URI).
 * This model never attaches to default mongoose connection.
 */
const agodaConn = getAgodaConnection();

// Prevent OverwriteModelError in watch/hot-reload environments:
const AgodaHotel =
  agodaConn.models.AgodaHotel || agodaConn.model("AgodaHotel", AgodaHotelSchema);

module.exports = AgodaHotel;
