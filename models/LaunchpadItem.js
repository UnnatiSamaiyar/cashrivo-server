const mongoose = require("mongoose");

const LaunchpadItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    link: { type: String, required: true, trim: true },
    couponCode: { type: String, default: "", trim: true }, // optional
    exclusive: { type: Boolean, required: true, default: false }, // mandatory boolean (default false)

    // image mandatory
    image: {
      filename: { type: String, required: true },
      originalname: { type: String, required: true },
      mimetype: { type: String, required: true },
      size: { type: Number, required: true },
      url: { type: String, required: true }, // /uploads/launchpad/...
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LaunchpadItem", LaunchpadItemSchema);
