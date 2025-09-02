const ProductAdvertisingAPIv1 = require("../amazon-paapi/src/index.js");

const defaultClient = ProductAdvertisingAPIv1.ApiClient.instance;
defaultClient.accessKey = process.env.AMAZON_ACCESS_KEY;
defaultClient.secretKey = process.env.AMAZON_SECRET_KEY;
defaultClient.host = process.env.AMAZON_HOST;
defaultClient.region = process.env.AMAZON_REGION;

const api = new ProductAdvertisingAPIv1.DefaultApi();

const commonKeywordsIndia = [
 "Wireless Charger",
  "Portable Projector",
  "Action Camera",
  "Gaming Mouse",
  "Mechanical Keyboard",
  "Smart Home Devices",
  "LED Strip Lights",
  "VR Headset",
  "Noise Cancelling Headphones",
  "Smart Doorbell",
  "Athleisure Wear",
  "Ethnic Footwear",
  "Designer Handbags",
  "Sunglasses",
  "Smart Watches for Women",
  "Fitness Apparel",
  "Caps & Hats",
  "Wallets",
  "Belts",
  "Jewelry Sets",
  "Air Fryer",
  "Robot Vacuum",
  "Water Purifier",
  "Smart Thermostat",
  "Pressure Cooker",
  "Espresso Machine",
  "Blender",
  "Eco-friendly Storage",
  "Portable Heater",
  "Dehumidifier",
  "Yoga Mat",
  "Resistance Bands",
  "Cycling Gear",
  "Skateboard",
  "Camping Tent",
  "Hiking Backpack",
  "Dumbbell Set",
  "Cricket Helmet",
  "Football Shoes",
  "Trekking Poles",
  "Self-Help Books",
  "Fiction Bestsellers",
  "Cooking Recipe Books",
  "Programming Guides",
  "Science Experiment Kits",
  "Puzzle Books",
  "Language Learning Books",
  "Art & Craft Kits",
  "Kids Educational Toys",
  "Mindfulness Journals",
  "Hair Straighteners",
  "Facial Cleanser",
  "Organic Skincare",
  "Perfume for Men",
  "Lip Care Products",
  "Body Lotion",
  "Makeup Brushes",
  "Essential Oils",
  "Beard Care Kit",
  "Anti-Aging Creams",
  "Cold Brew Coffee",
  "Gourmet Chocolates",
  "Protein Supplements",
  "Healthy Snacks",
  "Organic Honey",
  "Green Tea Bags",
  "Energy Drinks",
  "Vegan Cheese",
  "Spices & Herbs",
  "Nuts & Dry Fruits"
];

exports.searchTrendingIndia = async (req, res) => {
  try {
    let allItems = [];

    // 🔄 Pagination control from query params
    const page = parseInt(req.query.page) || 1; // default page = 1
    const limit = parseInt(req.query.limit) || 10; // default 10 keywords per batch
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const keywordsToSearch = commonKeywordsIndia.slice(startIndex, endIndex);

    for (const keyword of keywordsToSearch) {
      const searchItemsRequest =
        new ProductAdvertisingAPIv1.SearchItemsRequest();
      searchItemsRequest["PartnerTag"] = process.env.AMAZON_PARTNER_TAG;
      searchItemsRequest["PartnerType"] = "Associates";
      searchItemsRequest["Keywords"] = keyword;
      searchItemsRequest["SearchIndex"] = "All";
      searchItemsRequest["ItemCount"] = 2;
      searchItemsRequest["Resources"] = [
        "Images.Primary.Medium",
        "ItemInfo.Title",
        "Offers.Listings.Price",
        "Offers.Listings.SavingBasis",
      ];

      try {
        const data = await api.searchItems(searchItemsRequest);
        const response =
          ProductAdvertisingAPIv1.SearchItemsResponse.constructFromObject(data);

        if (response.SearchResult && response.SearchResult.Items) {
          const items = response.SearchResult.Items.map((item) => {
            const offer = item.Offers?.Listings?.[0];
            const price = offer?.Price?.DisplayAmount || null;
            const saving = offer?.SavingBasis?.DisplayAmount || null;

            let discountPercent = null;
            if (offer?.SavingBasis?.Amount && offer?.Price?.Amount) {
              const original = offer.SavingBasis.Amount;
              const current = offer.Price.Amount;
              discountPercent =
                (((original - current) / original) * 100).toFixed(0) + "%";
            }

            return {
              Keyword: keyword,
              ASIN: item.ASIN,
              Title: item.ItemInfo?.Title?.DisplayValue,
              URL: item.DetailPageURL,
              Image: item.Images?.Primary?.Medium?.URL,
              Price: price,
              OriginalPrice: saving,
              Discount: discountPercent,
            };
          });

          allItems.push(...items);
        }
      } catch (err) {
        if (err.message.includes("Too Many Requests")) {
          console.warn(`Keyword "${keyword}" skipped due to API rate limit.`);

          // 👇 Add a placeholder entry so frontend knows it failed
          allItems.push({
            Keyword: keyword,
            Error: "Rate limit exceeded",
            Items: [],
          });

          // optional: wait 1 sec before next call
          await new Promise((r) => setTimeout(r, 1000));
        } else {
          console.warn(`Keyword "${keyword}" failed:`, err.message);
        }
      }
    }

    res.json({
      success: true,
      page,
      limit,
      totalKeywords: commonKeywordsIndia.length,
      keywordsUsed: keywordsToSearch,
      items: allItems,
    });
  } catch (error) {
    console.error("Amazon API Error:", error);
    res
      .status(500)
      .json({ success: false, error: error.message || "Something went wrong" });
  }
};

// Controller function
exports.getItem = async (req, res) => {
  try {
    const { asin } = req.query; // ?asin=B0969KGM9B

    var getItemsRequest = new ProductAdvertisingAPIv1.GetItemsRequest();
    getItemsRequest["PartnerTag"] = process.env.AMAZON_PARTNER_TAG;
    getItemsRequest["PartnerType"] = "Associates";
    getItemsRequest["ItemIds"] = [asin];
    getItemsRequest["Condition"] = "New";
    getItemsRequest["Resources"] = [
      "Images.Primary.Medium",
      "ItemInfo.Title",
      "OffersV2.Listings.Price",
    ];

    const data = await api.getItems(getItemsRequest);
    const getItemsResponse =
      ProductAdvertisingAPIv1.GetItemsResponse.constructFromObject(data);

    res.json(getItemsResponse);
  } catch (error) {
    console.error("Amazon API Error:", error);
    res.status(500).json({ error: "Amazon API failed", details: error });
  }
};
