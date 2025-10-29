// ✅ Correct import (amazon-paapi package export structure)
const {
  ApiClient,
  DefaultApi,
  SearchItemsRequest,
  SearchItemsResponse,
  GetItemsRequest,
  GetItemsResponse,
} = require("amazon-paapi");

// ✅ Configure client
const client = ApiClient.instance;
client.accessKey = process.env.AMAZON_ACCESS_KEY;
client.secretKey = process.env.AMAZON_SECRET_KEY;
client.host = process.env.AMAZON_HOST;
client.region = process.env.AMAZON_REGION;

// ✅ Initialize API object
const api = new DefaultApi();

// (NO CHANGES) Your trending keyword list
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

// ✅ Trending Search API
exports.searchTrendingIndia = async (req, res) => {
  try {
    let allItems = [];

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const keywordsToSearch = commonKeywordsIndia.slice(
      (page - 1) * limit,
      page * limit
    );

    for (const keyword of keywordsToSearch) {
      const request = new SearchItemsRequest();
      request["PartnerTag"] = process.env.AMAZON_PARTNER_TAG;
      request["PartnerType"] = "Associates";
      request["Keywords"] = keyword;
      request["SearchIndex"] = "All";
      request["ItemCount"] = 2;
      request["Resources"] = [
        "Images.Primary.Medium",
        "ItemInfo.Title",
        "Offers.Listings.Price",
        "Offers.Listings.SavingBasis",
      ];

      try {
        const data = await api.searchItems(request);
        const response = SearchItemsResponse.constructFromObject(data);

        if (response.SearchResult?.Items) {
          const mapped = response.SearchResult.Items.map((item) => ({
            Keyword: keyword,
            ASIN: item.ASIN,
            Title: item.ItemInfo?.Title?.DisplayValue,
            URL: item.DetailPageURL,
            Image: item.Images?.Primary?.Medium?.URL,
            Price: item.Offers?.Listings?.[0]?.Price?.DisplayAmount || null,
          }));

          allItems.push(...mapped);
        }
      } catch (err) {
        console.warn(`Keyword "${keyword}" failed:`, err.message);
      }
    }

    res.json({ success: true, page, limit, items: allItems });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ✅ Get Single Product by ASIN
exports.getItem = async (req, res) => {
  try {
    const { asin } = req.query;

    const request = new GetItemsRequest();
    request["PartnerTag"] = process.env.AMAZON_PARTNER_TAG;
    request["PartnerType"] = "Associates";
    request["ItemIds"] = [asin];
    request["Resources"] = [
      "Images.Primary.Medium",
      "ItemInfo.Title",
      "Offers.Listings.Price",
    ];

    const data = await api.getItems(request);
    const item = GetItemsResponse.constructFromObject(data);

    res.json(item);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
