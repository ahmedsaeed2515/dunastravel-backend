const fs = require('fs');
const path = require('path');

const backendNodeModules = path.resolve('d:/@@project/LUXURY-PROJECT/dunastravel-backend/node_modules');
const { PrismaClient } = require(path.join(backendNodeModules, '@prisma/client'));
const { Pool } = require(path.join(backendNodeModules, 'pg'));
const { PrismaPg } = require(path.join(backendNodeModules, '@prisma/adapter-pg'));

const envPath = path.resolve('d:/@@project/LUXURY-PROJECT/dunastravel-backend/.env');
let envDbUrl = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
  if (match) envDbUrl = match[1];
}

const connectionString = process.env.DATABASE_URL || envDbUrl;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const LANGS = ['ar', 'en', 'es', 'it', 'pt'];

function hasAllLangs(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return LANGS.every(l => {
    const val = obj[l];
    if (Array.isArray(val)) return val.length > 0;
    return val && typeof val === 'string' && val.trim().length > 0;
  });
}

async function audit() {
  const tours = await prisma.tour.findMany({
    where: { deletedAt: null },
    include: {
      itineraries: { orderBy: { sortOrder: 'asc' } },
      images: { orderBy: { sortOrder: 'asc' } }
    }
  });

  console.log(`Auditing all ${tours.length} tours in the database...\n`);

  const issues = [];
  const validTours = [];

  for (const t of tours) {
    const tourIssues = [];

    // 1. Check Titles
    if (!hasAllLangs(t.titleJsonb)) {
      tourIssues.push(`titleJsonb missing languages: ${JSON.stringify(t.titleJsonb)}`);
    }

    // 2. Check Overviews
    if (!hasAllLangs(t.overviewJsonb)) {
      tourIssues.push(`overviewJsonb missing languages`);
    }

    // 3. Check Duration
    if (!hasAllLangs(t.durationJsonb)) {
      tourIssues.push(`durationJsonb missing languages`);
    }

    // 4. Check Inclusions
    if (!hasAllLangs(t.includedServicesJsonb)) {
      tourIssues.push(`includedServicesJsonb missing or incomplete`);
    }

    // 5. Check Exclusions
    if (!hasAllLangs(t.excludedServicesJsonb)) {
      tourIssues.push(`excludedServicesJsonb missing or incomplete`);
    }

    // 6. Check Highlights
    if (!hasAllLangs(t.highlightsJsonb)) {
      tourIssues.push(`highlightsJsonb missing or incomplete`);
    }

    // 7. Check Itinerary Days
    if (!t.itineraries || t.itineraries.length === 0) {
      tourIssues.push(`ZERO itinerary days`);
    } else {
      t.itineraries.forEach((d, idx) => {
        if (!hasAllLangs(d.titleJsonb)) {
          tourIssues.push(`Day ${idx+1} titleJsonb missing languages`);
        }
        if (!hasAllLangs(d.descriptionJsonb)) {
          tourIssues.push(`Day ${idx+1} descriptionJsonb missing languages`);
        }
      });
    }

    // 8. Check Images
    if (!t.images || t.images.length === 0) {
      tourIssues.push(`ZERO tour images`);
    }

    if (tourIssues.length > 0) {
      issues.push({
        id: t.id,
        slug: t.slug,
        category: t.category,
        issues: tourIssues
      });
    } else {
      validTours.push(t.slug);
    }
  }

  console.log(`=== AUDIT SUMMARY ===`);
  console.log(`✅ 100% Fully Complete Tours: ${validTours.length} / ${tours.length}`);
  console.log(`⚠️ Tours with Issues/Missing Fields: ${issues.length} / ${tours.length}\n`);

  if (issues.length > 0) {
    console.log(`--- DETAILS OF TOURS REQUIRING FIXES ---`);
    issues.forEach((iss, i) => {
      console.log(`[${i+1}] Slug: ${iss.slug} (${iss.category})`);
      iss.issues.forEach(msg => console.log(`    - ❌ ${msg}`));
    });
  }
}

audit()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
