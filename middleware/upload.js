const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Utility to ensure directory exists
const ensureDirExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const getMulterUploader = (folderName = 'uploads') => {
  const fullPath = path.join(__dirname, '..', folderName);
  ensureDirExists(fullPath);

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, fullPath);
    },
    filename: (req, file, cb) => {
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
