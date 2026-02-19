const { sendSuccess, sendError } = require('../utils/response');
const { uploadBuffer, deleteImage, publicIdFromUrl } = require('../utils/cloudinary');

const uploadSuccess = async (req, res) => {
  if (!req.file) {
    return sendError(res, 400, 'No file uploaded');
  }

  try {
    const result = await uploadBuffer(req.file.buffer, {
      public_id: req.file.originalname
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '') || 'image',
    });

    res.status(201);
    return sendSuccess(res, {
      url: result.url,
      publicId: result.publicId,
      originalName: req.file.originalname,
      size: req.file.size,
      width: result.width,
      height: result.height,
    });
  } catch (err) {
    console.error('[Upload] Cloudinary upload failed:', err);
    return sendError(res, 500, 'Image upload failed. Please try again.');
  }
};

const deleteUpload = async (req, res) => {
  const identifier = req.params.filename;

  // Support both public_id and full URL
  const publicId = identifier.startsWith('http')
    ? publicIdFromUrl(identifier)
    : identifier;

  if (!publicId) {
    return sendError(res, 400, 'Invalid image identifier');
  }

  try {
    await deleteImage(publicId);
    return res.status(204).send();
  } catch (err) {
    console.error('[Upload] Cloudinary delete failed:', err);
    return sendError(res, 500, 'Failed to delete image.');
  }
};

module.exports = {
  uploadSuccess,
  deleteUpload,
};
