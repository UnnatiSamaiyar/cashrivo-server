const express = require("express");
const router = express.Router();
const getMulterUploader = require("../middleware/upload");
const Blog = require("../models/Blogs");

// Setup multer for featuredImage and bannerImage
const upload = getMulterUploader("uploads/blogs");

// Two image fields: featuredImage and bannerImage
const cpUpload = upload.fields([
  { name: "featuredImage", maxCount: 1 },
  { name: "bannerImage", maxCount: 1 },
]);

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
    });

    await newBlog.save();

    res.status(201).json({ message: "Blog created successfully", blog: newBlog });
  } catch (err) {
    console.error("Error creating blog:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// READ
router.get("/get-blogs", async (req, res) => {
  try {
    const blogs = await Blog.find();
    res.status(200).json(blogs);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});

// READ SINGLE BLOG
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



module.exports = router;
