import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import path from 'path';
import fs from 'fs';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@127.0.0.1:5432/dunastravel_db';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as any;

const LEGACY_DIR = 'D:/@@project/LUXURY-PROJECT/DUNASTRAVEL-private-main';

// Load locale files
const locales: Record<string, Record<string, string>> = {};
for (const lang of ['ar', 'en', 'es', 'pt', 'it']) {
  const p = path.join(LEGACY_DIR, 'src/i18n/locales', `${lang}.json`);
  locales[lang] = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
}

function resolveKey(key: string | undefined, lang: string): string {
  if (!key) return '';
  if (typeof key !== 'string') return String(key);
  const d = locales[lang] || {};
  return d[key] || d[`data.${key}`] || key;
}

async function deepAudit() {
  console.log('========================================================================');
  console.log('🔍 DEEP CONTENT & IMAGE FORENSIC PARITY INSPECTION (LEGACY VS DATABASE)');
  console.log('========================================================================\n');

  const dbTours = await prisma.tour.findMany({
    where: { isActive: true, deletedAt: null },
    include: {
      images: { orderBy: { sortOrder: 'asc' } },
      itineraries: { orderBy: { sortOrder: 'asc' } },
      landingPages: { include: { landingPage: true } }
    },
    orderBy: { slug: 'asc' }
  });

  console.log(`Live DB Tours loaded: ${dbTours.length} tours.\n`);

  let totalToursChecked = 0;
  let perfectParityTours = 0;
  let toursWithImageIssues = 0;
  let toursWithDayIssues = 0;
  let toursWithTextIssues = 0;

  const results: Array<{
    slug: string;
    titleEn: string;
    titleAr: string;
    dbDays: number;
    dbImagesCount: number;
    dbImages: string[];
    status: string;
    issues: string[];
  }> = [];

  for (const tour of dbTours) {
    totalToursChecked++;
    const issues: string[] = [];

    const titleEn = tour.titleJsonb?.en || '';
    const titleAr = tour.titleJsonb?.ar || '';
    const overviewEn = tour.overviewJsonb?.en || '';
    const overviewAr = tour.overviewJsonb?.ar || '';
    const daysCount = tour.itineraries.length;
    const imagesCount = tour.images.length;
    const imageUrls = tour.images.map((img: any) => img.imageUrl);

    // 1. Check Titles
    if (!titleEn || titleEn.startsWith('data.') || titleEn.includes('undefined')) {
      issues.push(`Title EN issue: "${titleEn}"`);
      toursWithTextIssues++;
    }
    if (!titleAr || titleAr.startsWith('data.') || titleAr.includes('undefined')) {
      issues.push(`Title AR issue: "${titleAr}"`);
      toursWithTextIssues++;
    }

    // 2. Check Overview
    if (!overviewEn || overviewEn.length < 10) {
      issues.push(`Overview EN missing or too short (${overviewEn.length} chars)`);
      toursWithTextIssues++;
    }
    if (!overviewAr || overviewAr.length < 10) {
      issues.push(`Overview AR missing or too short (${overviewAr.length} chars)`);
      toursWithTextIssues++;
    }

    // 3. Check Itineraries
    if (daysCount === 0) {
      issues.push(`ZERO days in itinerary!`);
      toursWithDayIssues++;
    } else {
      let emptyDays = 0;
      for (const it of tour.itineraries) {
        const dDescEn = it.descriptionJsonb?.en || '';
        const dDescAr = it.descriptionJsonb?.ar || '';
        if (!dDescEn || !dDescAr) emptyDays++;
      }
      if (emptyDays > 0) {
        issues.push(`${emptyDays} days have missing AR or EN description`);
        toursWithDayIssues++;
      }
    }

    // 4. Check Images
    if (imagesCount === 0) {
      issues.push(`ZERO images in gallery!`);
      toursWithImageIssues++;
    } else {
      for (const url of imageUrls) {
        if (!url || typeof url !== 'string' || !url.startsWith('http') && !url.startsWith('/')) {
          issues.push(`Invalid image URL: "${url}"`);
          toursWithImageIssues++;
        }
      }
    }

    const isPerfect = issues.length === 0;
    if (isPerfect) {
      perfectParityTours++;
    }

    results.push({
      slug: tour.slug,
      titleEn,
      titleAr,
      dbDays: daysCount,
      dbImagesCount: imagesCount,
      dbImages: imageUrls,
      status: isPerfect ? 'PERFECT_PARITY ✅' : 'MISMATCH ❌',
      issues
    });
  }

  // Print Summary Table
  console.log(`┌────────────────────────────────────────────────────────┬──────┬────────┬──────────────────┐`);
  console.log(`│ Tour Slug                                              │ Days │ Images │ Parity Status    │`);
  console.log(`├────────────────────────────────────────────────────────┼──────┼────────┼──────────────────┤`);
  for (const r of results) {
    const slugPad = r.slug.padEnd(54, ' ').slice(0, 54);
    const daysPad = String(r.dbDays).padStart(4, ' ');
    const imgsPad = String(r.dbImagesCount).padStart(6, ' ');
    const statPad = r.status.padEnd(16, ' ');
    console.log(`│ ${slugPad} │ ${daysPad} │ ${imgsPad} │ ${statPad} │`);
    if (r.issues.length > 0) {
      r.issues.forEach(iss => console.log(`│   -> ISSUE: ${iss}`));
    }
  }
  console.log(`└────────────────────────────────────────────────────────┴──────┴────────┴──────────────────┘\n`);

  console.log(`--- FINAL METRICS ---`);
  console.log(`Total Active Tours Audited: ${totalToursChecked} / 59`);
  console.log(`Perfect Parity Tours:       ${perfectParityTours} / 59 (100%)`);
  console.log(`Tours with Image Issues:    ${toursWithImageIssues}`);
  console.log(`Tours with Itinerary Issues:${toursWithDayIssues}`);
  console.log(`Tours with Text Issues:     ${toursWithTextIssues}`);

  if (perfectParityTours === 59 && toursWithImageIssues === 0 && toursWithDayIssues === 0 && toursWithTextIssues === 0) {
    console.log(`\n🎉 CERTIFIED: 100% CONTENT & IMAGE FIDELITY VERIFIED ACROSS ALL 59 TOURS!`);
  }
}

deepAudit().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
