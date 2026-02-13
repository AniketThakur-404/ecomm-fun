const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const url = 'postgresql://neondb_owner:npg_d0IjZD4EOyMf@ep-steep-tooth-a1t2haht-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const adapter = new PrismaPg({ connectionString: url });
const p = new PrismaClient({ adapter });

async function verify() {
    const tables = ['user', 'product', 'collection', 'productVariant', 'productMedia', 'productOption', 'productCollection', 'order', 'review', 'location', 'inventoryLevel'];
    console.log('=== NEW DB Row Counts ===');
    for (const t of tables) {
        try {
            const count = await p[t].count();
            console.log(`  ${t}: ${count}`);
        } catch (e) {
            console.log(`  ${t}: ERROR - ${e.message}`);
        }
    }
    await p.$disconnect();
}
verify();
