const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const safeExt = path.extname(file.originalname).toLowerCase();
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + safeExt);
  }
});

const allowed = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime'
]);

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 12 },
  fileFilter: (_, file, cb) => {
    if (!allowed.has(file.mimetype)) return cb(new Error('Запрещённый тип файла'));
    cb(null, true);
  }
});

module.exports = upload;
