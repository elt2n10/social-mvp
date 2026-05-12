const fs = require('fs');
const { v2: cloudinary } = require('cloudinary');

function cloudinaryEnabled() {
  return Boolean(process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET));
}

function configureCloudinary() {
  if (process.env.CLOUDINARY_URL) return;
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
  }
}

async function saveUploadedFile(file, folder = 'yved') {
  if (!file) return '';
  if (!cloudinaryEnabled()) return `/uploads/${file.filename}`;
  configureCloudinary();
  const resourceType = file.mimetype && file.mimetype.startsWith('video/') ? 'video' : 'image';
  const result = await cloudinary.uploader.upload(file.path, {
    folder,
    resource_type: resourceType,
    overwrite: false
  });
  fs.promises.unlink(file.path).catch(() => {});
  return result.secure_url;
}

module.exports = { saveUploadedFile, cloudinaryEnabled };
