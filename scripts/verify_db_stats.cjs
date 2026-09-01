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

async function verifyAll() {
  const activeTours = await prisma.tour.findMany({
    where: { deletedAt: null, isActive: true },
    include: {
      itineraries: { orderBy: { sortOrder: 'asc' } },
      images: { orderBy: { sortOrder: 'asc' } }
    }
  });

  console.log('========================================');
  console.log('       POSTGRESQL LIVE DATABASE STATS   ');
  console.log('========================================');
  console.log('Total Active Tours:', activeTours.length);
  
  const langs = ['ar', 'en', 'es', 'pt', 'it'];
  let fullyTranslated = 0;

  activeTours.forEach(t => {
    const hasAllTitles = langs.every(l => t.titleJsonb && t.titleJsonb[l] && t.titleJsonb[l].trim().length > 0);
    if (hasAllTitles) fullyTranslated++;
  });

  const percentage = ((fullyTranslated / activeTours.length) * 100).toFixed(0);
  console.log(`Fully Translated (5 Languages): ${fullyTranslated}/${activeTours.length} (${percentage}%)`);

  const countrySummary = {};
  activeTours.forEach(t => {
    countrySummary[t.country] = (countrySummary[t.country] || 0) + 1;
  });
  console.log('Tours By Country:', countrySummary);

  const landingPages = await prisma.tourLandingPage.findMany({
    where: { type: 'DESTINATION', deletedAt: null },
    include: {
      tours: {
        where: { tour: { deletedAt: null, isActive: true } }
      }
    }
  });

  console.log('\n--- Destination Landing Pages Linked ---');
  landingPages.forEach(lp => {
    console.log(`  - ${lp.slug}: ${lp.tours.length} tours linked`);
  });

  console.log('========================================');

  await pool.end();
}

verifyAll().catch(console.error);
