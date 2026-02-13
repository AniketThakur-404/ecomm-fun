const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const globalForPrisma = globalThis;
const resolveConnectionString = () =>
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.NEON_POSTGRES_URL ||
  null;

let prisma = globalForPrisma.__marvellaPrisma || null;

const ensurePrisma = () => {
  if (prisma) return prisma;

  const connectionString = resolveConnectionString();
  if (!connectionString) {
    const error = new Error(
      'Database is not configured. Set DATABASE_URL (or POSTGRES_URL / POSTGRES_PRISMA_URL).',
    );
    error.status = 503;
    throw error;
  }

  const adapter = new PrismaPg({ connectionString });
  prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.__marvellaPrisma = prisma;
  }

  return prisma;
};

const getPrisma = async () => ensurePrisma();

const warmUp = async () => {
  try {
    const start = Date.now();
    const client = ensurePrisma();
    await client.$queryRawUnsafe('SELECT 1');
    console.log(`[DB] ✅ Prisma warm-up done in ${Date.now() - start}ms`);
  } catch (err) {
    console.warn('[DB] ⚠️ Prisma warm-up failed (will retry on first request):', err.message);
  }
};

const disconnect = async () => {
  if (!prisma) return;
  await prisma.$disconnect();
};

module.exports = {
  getPrisma,
  disconnect,
  warmUp,
};
