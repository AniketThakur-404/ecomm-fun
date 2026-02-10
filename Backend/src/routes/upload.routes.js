const express = require('express');
const multer = require('multer');
const path = require('node:path');
const crypto = require('node:crypto');

const { uploadSuccess, deleteUpload } = require('../controllers/upload.controller');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

const uploadsDir = path.join(__dirname, '../../uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const unique = crypto.randomUUID();
    cb(null, `${name}-${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

router.post('/', protect, requireRole('ADMIN'), upload.single('image'), uploadSuccess);
router.delete('/:filename', protect, requireRole('ADMIN'), deleteUpload);

module.exports = router;
