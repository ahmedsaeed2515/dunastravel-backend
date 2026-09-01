const fs = require('fs');
const path = require('path');
const backendNodeModules = path.resolve('d:/@@project/LUXURY-PROJECT/dunastravel-backend/node_modules');
const { PrismaClient } = require(path.join(backendNodeModules, '@prisma/client'));
const { Pool } = require(path.join(backendNodeModules, 'pg'));
const { PrismaPg } = require(path.join(backendNodeModules, '@prisma/adapter-pg'));

const envContent = fs.readFileSync('d:/@@project/LUXURY-PROJECT/dunastravel-backend/.env', 'utf8');
const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
const connectionString = match[1];

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
  const tours = await prisma.tour.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, country: true, status: true, isActive: true, sourceCatalogId: true }
  });
  console.log('--- POSTGRES DB AUDIT ---');
  console.log('Total tours in PostgreSQL DB:', tours.length);
  const byCountry = {};
  tours.forEach(t => {
    byCountry[t.country] = (byCountry[t.country] || 0) + 1;
  });
  console.log('By Country in DB:', byCountry);
  await pool.end();
}

check().catch(console.error);
