const ProductAdvertisingAPIv1 = require("../amazon-paapi/src/index.js");

const defaultClient = ProductAdvertisingAPIv1.ApiClient.instance;
defaultClient.accessKey = process.env.AMAZON_ACCESS_KEY;
defaultClient.secretKey = process.env.AMAZON_SECRET_KEY;
defaultClient.host = process.env.AMAZON_HOST;
defaultClient.region = process.env.AMAZON_REGION;

const api = new ProductAdvertisingAPIv1.DefaultApi();

const commonKeywordsIndia = [
  "Smart TV 4K",
  "Wireless Earbuds",
  "True Wireless Earphones",
  "Portable SSD",
  "Gaming Chair",
  "Electric Scooter",
  "Smart Helmet",
  "Air Purifier",
  "Smart Air Fryer",
  "Robot Vacuum Cleaner",
  "Smart Door Lock",
  "Solar Power Bank",
  "Gaming Laptop",
  "Streaming Device",
  "Home Security Camera",
  "4K Action Camera",
  "Drone Camera",
  "Wearable Health Tracker",
  "Sleep Tracker",
  "Smart Ring",
  "Electric Toothbrush",
  "Water Flosser",
  "Electric Kettle",
  "Instant Pot",
  "Slow Juicer",
  "Portable Blender",
  "Smart Lighting System",
  "Smart Switch",
  "USB-C Hub",
  "AI Speaker",
  "Graphics Tablet",
  "Mechanical Gaming Keyboard",
  "Gaming Mouse",
  "Ergonomic Chair",
  "Office Desk",
  "Fitness Smartwatch",
  "Smart Scale",
  "Wireless Charger 30W",
  "PD Fast Charger",
  "Gaming Router",
  "Mesh WiFi",
  "Bluetooth Tracker",
  "Smart Doorbell",
  "Pet Camera",
  "Camera Gimbal",
  "Action Cam 4K",
  "Adventure Camera",
  "Mirrorless Camera",
  "DSLR Kit",
  "Photography Lens",
  "Vintage Watch",
  "Sneakers Running",
  "Streetwear Hoodie",
  "Athleisure Tracksuit",
  "Organic Skincare",
  "Minimalist Wallet",
  "Travel Backpack",
  "Luggage Set",
  "Camping Gear",
  "Portable Stove",
  "Tent Waterproof",
  "Solar Lantern",
  "Yoga Mat Pro",
  "Resistance Bands Set",
  "Smart Bike Trainer",
  "Foldable Bike",
  "Electric Scooter 250W",
  "Premium Tea Set",
  "Cold Brew Coffee Maker",
  "Electric Wine Opener",
  "Soundbar Dolby Atmos",
  "Mini Projector 1080p",
  "Home Theater System",
  "Security DVR Kit",
  "Smart Irrigation System",
  "Diwali Gifts",
  "Diwali Decor",
  "Fairy Lights",
  "Rangoli Kit",
  "Eco Friendly Diyas",
  "LED String Lights",
  "Ganesha Idol Brass",
  "Lakshmi Idol",
  "Pooja Thali Set",
  "Silver Coins Diwali",
  "Gold Coin 24K",
  "Dry Fruits Gift Box",
  "Sweets Hamper",
  "Chocolate Box",
  "Ethnic Kurta Set",
  "Silk Saree",
  "Designer Lehenga",
  "Kurta Pajama",
  "Traditional Jewelry",
  "Temple Jewelry",
  "Gold Plated Earrings",
  "Gift Hampers 2025",
  "Smart Watch Diwali Offer",
  "Smartphone Diwali Sale",
  "Gaming Console Offer",
  "LED TV Festive Sale",
  "Air Purifier Festive Discount",
  "Robot Vacuum Sale",
  "Home Decor 2025",
  "Wall Art Diwali",
  "Caramel Lights",
  "Smart Doorbell Offer",
  "Security Camera Diwali",
  "Kitchen Appliances Sale",
  "Mixer Grinder Offer",
  "Air Fryer Diwali",
  "Instant Pot Offer",
  "Fragrance Diffuser",
  "Scented Candles",
  "Electric Kettle Festive",
  "Portable Projector Offer",
  "Bluetooth Speaker Festive",
  "Gaming Mouse Diwali",
  "Mechanical Keyboard Sale",
  "Travel Bag Offer",
  "Luggage Sale",
  "Backpack Gift",
  "Perfume Gift Set",
  "Cosmetic Kit Festive",
  "Skincare Hamper",
  "Hair Straightener Sale",
  "Grooming Kit Gift",
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
