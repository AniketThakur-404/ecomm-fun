const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ override: true, quiet: true });
dotenv.config({ path: path.join(__dirname, '.env'), override: false, quiet: true });

const { env } = require('./src/config');
const { errorHandler } = require('./src/middleware/error');
const userRoutes = require('./src/routes/user.routes');
const productRoutes = require('./src/routes/product.routes');
const adminRoutes = require('./src/routes/admin.routes');
const collectionRoutes = require('./src/routes/collection.routes');
const uploadRoutes = require('./src/routes/upload.routes');
const reviewRoutes = require('./src/routes/review.routes');
const orderRoutes = require('./src/routes/order.routes');
const { getUploadsDir } = require('./src/utils/uploads');

const app = express();

const normalizeOrigin = (value) =>
  typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';

const parseOrigins = (value) =>
  String(value || '')
    .split(/[,\s]+/)
    .map((entry) => normalizeOrigin(entry))
    .filter(Boolean);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const extraOrigins = parseOrigins(process.env.FRONTEND_URLS);
const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
const allowedOrigins = [
  env.frontendUrl,
  ...extraOrigins,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  vercelUrl,
]
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);
const allowedOriginSet = new Set(allowedOrigins);

const allowVercelPreview = ['1', 'true', 'yes'].includes(
  String(process.env.ALLOW_VERCEL_PREVIEW || '').toLowerCase(),
);
const vercelProjectName =
  process.env.FRONTEND_VERCEL_PROJECT_NAME || process.env.VERCEL_PROJECT_NAME;
const vercelOriginRegex =
  allowVercelPreview && vercelProjectName
    ? new RegExp(
      `^https://${escapeRegex(
        vercelProjectName,
      )}(?:-[a-z0-9-]+)?\\.vercel\\.app$`,
      'i',
    )
    : null;

const isLocalDevOrigin = (origin = '') => {
  if (typeof origin !== 'string') return false;
  return origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
};

const isVercelPreviewOrigin = (origin = '') => {
  if (!vercelOriginRegex) return false;
  return vercelOriginRegex.test(origin);
};

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const normalized = normalizeOrigin(origin);
    if (
      allowedOriginSet.has(normalized) ||
      isLocalDevOrigin(normalized) ||
      isVercelPreviewOrigin(normalized)
    ) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: Origin not allowed: ${origin}`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(getUploadsDir()));

app.get('/', (_req, res) => {
  res.status(200).json({ message: 'Marvelle API is running successfully.' });
});

app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/products', productRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/orders', orderRoutes);

app.use((err, req, res, next) => {
  if (err && String(err.message || '').startsWith('CORS:')) {
    return res.status(403).json({ error: err.message });
  }
  return errorHandler(err, req, res, next);
});

app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));

const { warmUp } = require('./src/db/prismaClient');

if (env.nodeEnv !== 'production') {
  app.listen(env.port, () => {
    console.log(`Marvelle API ready on http://localhost:${env.port}`);
    warmUp();
  });
}

module.exports = app;
