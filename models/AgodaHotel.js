// models/AgodaHotel.js
const mongoose = require("mongoose");

const AgodaHotelSchema = new mongoose.Schema({
  cityId: { type: Number, index: true, required: true },
  hotelId: { type: Number, index: true, required: true },
  hotelName: String,
  starRating: Number,
  reviewScore: Number,
  reviewCount: Number,
  currency: String,
  dailyRate: Number,
  crossedOutRate: Number,
  discountPercentage: Number,
  imageURL: String,
  landingURL: String,
  includeBreakfast: Boolean,
  freeWifi: Boolean,
  latitude: Number,
  longitude: Number,
  raw: { type: Object },        // store raw response chunk if needed
  lastFetchedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
}, {
  collection: "agoda_hotels"
});

// Unique compound index to avoid duplicates per city+hotel
AgodaHotelSchema.index({ cityId: 1, hotelId: 1 }, { unique: true });

module.exports = mongoose.model("AgodaHotel", AgodaHotelSchema);
