const fs = require('node:fs');
const path = require('node:path');

const { sendSuccess, sendError } = require('../utils/response');
const { getUploadsDir } = require('../utils/uploads');

const getUploadUrl = (req, filename) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/uploads/${filename}`;
};

const uploadSuccess = (req, res) => {
  if (!req.file) {
    return sendError(res, 400, 'No file uploaded');
  }

  const fileUrl = getUploadUrl(req, req.file.filename);
  res.status(201);
  return sendSuccess(res, {
    url: fileUrl,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
  });
};

const deleteUpload = (req, res) => {
  const filename = req.params.filename;
  const uploadsDir = getUploadsDir();
  const filepath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filepath)) {
    return sendError(res, 404, 'File not found');
  }

  fs.unlinkSync(filepath);
  return res.status(204).send();
};

module.exports = {
  uploadSuccess,
  deleteUpload,
};
