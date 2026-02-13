const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_UPLOADS_DIR = path.join(__dirname, '../../uploads');
const SERVERLESS_UPLOADS_DIR = path.join('/tmp', 'marvelle-uploads');

const ensureDir = (dir) => {
  try {
    fs.mkdirSync(dir, { recursive: true });
    return true;
  } catch {
    return false;
  }
};

let cachedUploadsDir = null;

const getUploadsDir = () => {
  if (cachedUploadsDir) return cachedUploadsDir;

  if (ensureDir(DEFAULT_UPLOADS_DIR)) {
    cachedUploadsDir = DEFAULT_UPLOADS_DIR;
    return cachedUploadsDir;
  }

  if (ensureDir(SERVERLESS_UPLOADS_DIR)) {
    cachedUploadsDir = SERVERLESS_UPLOADS_DIR;
    return cachedUploadsDir;
  }

  cachedUploadsDir = DEFAULT_UPLOADS_DIR;
  return cachedUploadsDir;
};

module.exports = {
  getUploadsDir,
};
