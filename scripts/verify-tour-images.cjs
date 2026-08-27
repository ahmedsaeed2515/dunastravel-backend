const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient, MediaEntityType } = require('@prisma/client');
require('dotenv').config();

const ROOT = path.resolve(__dirname, '..', '..');
const FRONTEND_PUBLIC = path.join(ROOT, 'frontend', 'public');
const SOURCE_PROJECT = path.join(ROOT, 'dunas-travel2026.com');
const CATALOG_PATH = path.join(__dirname, '..', 'prisma', 'data', 'ahmed-tours.current.json');
const REPORT_PATH = path.join(__dirname, '..', 'reports', 'tour-image-verification.json');

function resolveLocal(ref) {
  if (!ref || /^https?:\/\//i.test(ref)) return null;
  const relative = ref.replace(/^\/+/, '').replace(/\\/g, '/');
  const candidates = [
    path.join(FRONTEND_PUBLIC, relative),
    path.join(SOURCE_PROJECT, 'public', relative),
    path.join(SOURCE_PROJECT, 'src', relative),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

async function readImage(ref) {
  const localPath = resolveLocal(ref);
  if (localPath) return fs.readFileSync(localPath);
  const response = await fetch(ref, { redirect: 'follow', signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const result = {
    sourceTours: catalog.length,
    sourceImageRefs: 0,
    sourceImagesMatched: 0,
    activeTourImageRows: 0,
    activeCanonicalMediaAssets: 0,
    duplicateImagesWithinTour: [],
    nonCloudinaryActiveTourImages: [],
    missingSourceImages: [],
    activeDestinationHeroesWithoutCloudinary: [],
    passed: false,
    generatedAt: new Date().toISOString(),
  };
  try {
    const [tours, assets, pages] = await Promise.all([
      prisma.tour.findMany({ where: { deletedAt: null }, select: { slug: true, images: { orderBy: { sortOrder: 'asc' }, select: { imageUrl: true } } } }),
      prisma.mediaAsset.findMany({ where: { deletedAt: null, entityType: MediaEntityType.GENERAL }, select: { publicId: true } }),
      prisma.tourLandingPage.findMany({ where: { deletedAt: null, isActive: true }, select: { slug: true, heroImageUrl: true } }),
    ]);
    const toursBySlug = new Map(tours.map((tour) => [tour.slug, tour]));
    result.activeTourImageRows = tours.reduce((sum, tour) => sum + tour.images.length, 0);
    result.activeCanonicalMediaAssets = assets.filter((asset) => asset.publicId.startsWith('dunas-travel/catalog/')).length;
    for (const tour of tours) {
      const urls = tour.images.map((image) => image.imageUrl);
      const duplicates = urls.filter((url, index) => urls.indexOf(url) !== index);
      if (duplicates.length) result.duplicateImagesWithinTour.push({ slug: tour.slug, urls: [...new Set(duplicates)] });
      for (const image of tour.images) {
        if (!/^https:\/\/res\.cloudinary\.com\//.test(image.imageUrl)) {
          result.nonCloudinaryActiveTourImages.push({ slug: tour.slug, url: image.imageUrl });
        }
      }
    }
    for (const sourceTour of catalog) {
      const dbTour = toursBySlug.get(sourceTour.slug);
      for (const sourceImage of sourceTour.images || []) {
        result.sourceImageRefs++;
        try {
          const buffer = await readImage(sourceImage.imageUrl);
          const hash = crypto.createHash('sha256').update(buffer).digest('hex');
          const found = dbTour?.images.some((image) => image.imageUrl.includes(`/catalog/${hash}.webp`));
          if (found) result.sourceImagesMatched++;
          else result.missingSourceImages.push({ slug: sourceTour.slug, sourceUrl: sourceImage.imageUrl, expectedHash: hash });
        } catch (error) {
          result.missingSourceImages.push({ slug: sourceTour.slug, sourceUrl: sourceImage.imageUrl, message: String(error?.message || error) });
        }
      }
    }
    for (const page of pages) {
      if (page.heroImageUrl && !/^https:\/\/res\.cloudinary\.com\//.test(page.heroImageUrl)) {
        result.activeDestinationHeroesWithoutCloudinary.push({ slug: page.slug, url: page.heroImageUrl });
      }
    }
    result.passed = result.sourceImagesMatched === result.sourceImageRefs &&
      result.duplicateImagesWithinTour.length === 0 &&
      result.nonCloudinaryActiveTourImages.length === 0 &&
      result.activeDestinationHeroesWithoutCloudinary.length === 0;
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.passed ? 0 : 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
