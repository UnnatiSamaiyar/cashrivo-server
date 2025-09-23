const express = require("express");
const router = express.Router();
const LmdOffer = require("../models/LmdOffers"); // Adjust path if needed

function parseDate(dateStr) {
  if (!dateStr) return null;

  const [day, month, year] = dateStr.split("-").map(Number);
  if (!day || !month || !year) return null;

  // Return JS Date object
  return new Date(year, month - 1, day); // month-1 kyunki JS me month 0-indexed
}

// POST /import-lmdoffers
router.post("/import-lmdoffers", async (req, res) => {
  try {
    const offers = req.body.offers;
    if (!Array.isArray(offers)) {
      return res
        .status(400)
        .json({ success: false, message: "Offers should be an array" });
    }

    const processedOffers = offers
      .map((offer, idx) => {
        try {
          return {
            lmd_id: Number(offer.lmd_id) || 0,
            store: offer.store || "",
            merchant_homepage: offer.merchant_homepage || "",
            long_offer: offer.long_offer || "",
            title: offer.title || "",
            description: offer.description || "",
            code: offer.code || "",
            terms_and_conditions: offer.terms_and_conditions || "",
            categories:
              typeof offer.categories === "string"
                ? offer.categories.split(",").map((c) => c.trim())
                : Array.isArray(offer.categories)
                ? offer.categories
                : [],
            featured: String(offer.featured).toLowerCase() === "yes",
            publisher_exclusive: offer.publisher_exclusive || "N",
            url: offer.url || "",
            smartlink: offer.smartlink || "",
            image_url: offer.image_url || "",
            type: offer.type || "",
            offer: offer.offer || "",
            offer_value: offer.offer_value || "",
            status: offer.status || "active",
            start_date: parseDate(offer.start_date),
            end_date: parseDate(offer.end_date),
          };
        } catch (err) {
          console.warn(
            `❌ Skipping offer at index ${idx} due to error:`,
            err.message
          );
          return null;
        }
      })
      .filter(Boolean);

    // ✅ Get all lmd_ids to check for existing ones
    const lmdIds = processedOffers.map((offer) => offer.lmd_id);
    const existing = await LmdOffer.find({ lmd_id: { $in: lmdIds } }, "lmd_id");
    const existingIds = new Set(existing.map((e) => e.lmd_id));

    // ✅ Filter out offers that already exist
    const uniqueOffers = processedOffers.filter(
      (offer) => !existingIds.has(offer.lmd_id)
    );

    if (uniqueOffers.length === 0) {
      return res.status(200).json({
        success: true,
        message: "All offers are duplicates. Nothing imported.",
      });
    }

    await LmdOffer.insertMany(uniqueOffers);
    return res.status(200).json({
      success: true,
      message: `${uniqueOffers.length} new offers imported successfully`,
    });
  } catch (error) {
    console.error("Error importing LMD offers:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to import offers" });
  }
});

// GET /all-lmdoffers
router.get("/all-lmdoffers", async (req, res) => {
  try {
    const now = new Date();

    // Delete offers with end_date before yesterday
    await LmdOffer.deleteMany({
      end_date: {
        $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });

    // Fetch only offers that have a valid code and haven't expired
    const offers = await LmdOffer.find({
      end_date: {
        $gte: new Date(now.setHours(0, 0, 0, 0)),
      },
      code: { $ne: "" }, // Exclude entries with null code
    }).sort({ createdAt: -1 });

    console.log("Total offers fetched:", offers.length);

    res.status(200).json({ success: true, data: offers });
  } catch (error) {
    console.error("Error fetching offers:", error);
    res.status(500).json({ success: false, message: "Failed to fetch offers" });
  }
});


// MULTER UPLOAD (optional for image_url override)
const getMulterUploader = require("../middleware/upload");
const upload = getMulterUploader("uploads/lmdoffers");

// PUT /edit-lmdoffer/:id
router.put(
  "/edit-lmdoffer/:id",
  upload.fields([{ name: "image_url", maxCount: 1 }]),
  async (req, res) => {
    try {
      const offerId = req.params.id;
      const {
        lmd_id,
        store,
        merchant_homepage,
        long_offer,
        title,
        description,
        code,
        terms_and_conditions,
        categories,
        featured,
        publisher_exclusive,
        url,
        smartlink,
        type,
        offer,
        offer_value,
        status,
        start_date,
        end_date,
      } = req.body;

      const updateFields = {
        ...(lmd_id && { lmd_id: Number(lmd_id) }),
        ...(store && { store }),
        ...(merchant_homepage && { merchant_homepage }),
        ...(long_offer && { long_offer }),
        ...(title && { title }),
        ...(description && { description }),
        ...(code && { code }),
        ...(terms_and_conditions && { terms_and_conditions }),
        ...(url && { url }),
        ...(smartlink && { smartlink }),
        ...(type && { type }),
        ...(offer && { offer }),
        ...(offer_value && { offer_value }),
        ...(status && { status }),
        ...(publisher_exclusive && { publisher_exclusive }),
      };

      if (start_date) updateFields.start_date = parseDate(start_date);
      if (end_date) updateFields.end_date = parseDate(end_date);
      if (categories) {
        updateFields.categories =
          typeof categories === "string"
            ? categories.split(",").map((c) => c.trim())
            : Array.isArray(categories)
            ? categories
            : [];
      }

      if (featured) {
        updateFields.featured = featured.toLowerCase() === "yes";
      }

      if (req.files.image_url && req.files.image_url[0]) {
        updateFields.image_url = `/uploads/lmdoffers/${req.files.image_url[0].filename}`;
      }

      const updatedOffer = await LmdOffer.findByIdAndUpdate(
        offerId,
        { $set: updateFields },
        { new: true }
      );

      if (!updatedOffer) {
        return res
          .status(404)
          .json({ success: false, message: "Offer not found" });
      }

      res.status(200).json({
        success: true,
        data: updatedOffer,
        message: "Offer updated successfully",
      });
    } catch (error) {
      console.error("Error updating LMD offer:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to update offer" });
    }
  }
);

module.exports = router;
