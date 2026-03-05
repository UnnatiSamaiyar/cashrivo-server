const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Utility to ensure directory exists
const ensureDirExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

/**
 * getMulterUploader(folderName?, options?)
 * - folderName: relative folder under server root (one level above this file)
 * - options.filename: (req, file) => string  (must include extension)
 *
 * Backward compatible: calling getMulterUploader('uploads') works same.
 */
const getMulterUploader = (folderName = 'uploads', options = {}) => {
  const fullPath = path.join(__dirname, '..', folderName);
  ensureDirExists(fullPath);

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, fullPath);
    },
    filename: (req, file, cb) => {
      try {
        if (options && typeof options.filename === "function") {
          const name = options.filename(req, file);
          if (name && typeof name === "string") return cb(null, name);
        }
      } catch (e) {
        // fall back
      }
      const uniqueName = `${Date.now()}-${file.originalname}`;
      cb(null, uniqueName);
    },
  });

  const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (.jpg, .jpeg, .png, .webp, .gif)'));
    }
  };

  return multer({ storage, fileFilter });
};

module.exports = getMulterUploader;
