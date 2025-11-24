// routes/blogs.js  (replace your existing router file content with this keeping your existing imports if different)
const express = require("express");
const router = express.Router();
const getMulterUploader = require("../middleware/upload");
const Blog = require("../models/Blogs");

// Setup multer for featuredImage and bannerImage and editor image uploads
const upload = getMulterUploader("uploads/blogs");

// Two image fields: featuredImage and bannerImage
const cpUpload = upload.fields([
  { name: "featuredImage", maxCount: 1 },
  { name: "bannerImage", maxCount: 1 },
]);

// Helper: extract image URLs from HTML content
function extractImageSrcsFromHtml(html = "") {
  const srcs = [];
  try {
    // Simple regex to extract src attributes from <img> tags (works for typical cases)
    const re = /<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let m;
    while ((m = re.exec(html))) {
      if (m[1]) srcs.push(m[1]);
    }
  } catch (err) {
    // ignore
  }
  // return unique
  return Array.from(new Set(srcs));
}

// Upload endpoint for editor images
router.post("/upload-editor-image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    // if you want to send full URL:
    const host = req.get("host");
    const protocol = req.protocol;
    // adjust path according to your static serving setup; here it's "uploads/blogs/<filename>"
    const url = `${protocol}://${host}/uploads/blogs/${req.file.filename}`;
    return res.status(201).json({ filename: req.file.filename, url });
  } catch (err) {
    console.error("Editor image upload failed:", err);
    return res.status(500).json({ error: "Upload failed" });
  }
});

// CREATE
router.post("/create", cpUpload, async (req, res) => {
  try {
    const {
      title,
      description,
      bannerDesc,
      bannerLink,
      tags,
      category,
      content,
    } = req.body;

    const featuredImage = req.files?.featuredImage?.[0]?.filename || null;
    const bannerImage = req.files?.bannerImage?.[0]?.filename || null;

    // Extract image srcs from content and store in blog.images
    const images = extractImageSrcsFromHtml(content || "");

    const newBlog = new Blog({
      title,
      description,
      featuredImage,
      bannerImage,
      bannerDesc,
      bannerLink,
      tags: tags ? tags.split(",").map(tag => tag.trim()) : [],
      category,
      content,
      images,
    });

    await newBlog.save();

    res.status(201).json({ message: "Blog created successfully", blog: newBlog });
  } catch (err) {
    console.error("Error creating blog:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// READ all
router.get("/get-blogs", async (req, res) => {
  try {
    const blogs = await Blog.find();
    res.status(200).json(blogs);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});

// READ single
router.get("/get-blog/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }
    res.status(200).json(blog);
  } catch (error) {
    console.error("Error fetching blog:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// UPDATE
router.put("/update-blog/:id", cpUpload, async (req, res) => {
  try {
    const {
      title,
      description,
      bannerDesc,
      bannerLink,
      tags,
      category,
      content,
    } = req.body;

    const featuredImage = req.files?.featuredImage?.[0]?.filename;
    const bannerImage = req.files?.bannerImage?.[0]?.filename;

    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ error: "Blog not found" });

    blog.title = title;
    blog.description = description;
    if (featuredImage) blog.featuredImage = featuredImage;
    if (bannerImage) blog.bannerImage = bannerImage;
    blog.bannerDesc = bannerDesc;
    blog.bannerLink = bannerLink;
    blog.tags = tags ? tags.split(",").map((tag) => tag.trim()) : [];
    blog.category = category;
    blog.content = content;

    // update images array from content
    blog.images = extractImageSrcsFromHtml(content || "");

    await blog.save();

    res.status(200).json({ message: "Blog updated", blog });
  } catch (err) {
    console.error("Error updating blog:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
