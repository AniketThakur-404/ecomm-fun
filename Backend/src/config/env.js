const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ override: true, quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: false, quiet: true });

const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev_secret',
  databaseUrl: process.env.DATABASE_URL,
  frontendUrl: process.env.FRONTEND_URL,
};

module.exports = { env };
