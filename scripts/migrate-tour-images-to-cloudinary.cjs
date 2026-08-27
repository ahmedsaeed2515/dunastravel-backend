const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient, MediaEntityType, MediaProvenance } = require('@prisma/client');
const { v2: cloudinary } = require('cloudinary');
require('dotenv').config();

const ROOT = path.resolve(__dirname, '..', '..');
const FRONTEND_PUBLIC = path.join(ROOT, 'frontend', 'public');
const SOURCE_PROJECT = path.join(ROOT, 'dunas-travel2026.com');
const CATALOG_PATH = path.join(__dirname, '..', 'prisma', 'data', 'ahmed-tours.current.json');
const REPORT_PATH = path.join(__dirname, '..', 'reports', 'tour-image-migration.json');
const MAX_BYTES = 10 * 1024 * 1024;
const isExecute = process.argv.includes('--execute');
const skipUnavailable = process.argv.includes('--skip-unavailable');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function readCatalog() {
  if (!fs.existsSync(CATALOG_PATH)) {
    throw new Error(`Missing current Ahmed catalog snapshot: ${CATALOG_PATH}`);
  }
  return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
}

function normalizeRef(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    return url.toString();
  }
  return decodeURIComponent(trimmed.replace(/\\/g, '/'));
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' })[ext] || null;
}

function resolveLocal(ref) {
  if (!ref || /^https?:\/\//i.test(ref)) return null;
  const relative = ref.replace(/^\/+/, '');
  const candidates = [
    path.join(FRONTEND_PUBLIC, relative),
    path.join(SOURCE_PROJECT, 'public', relative),
    path.join(SOURCE_PROJECT, 'src', relative),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  const basename = path.basename(relative).toLowerCase();
  const roots = [
    FRONTEND_PUBLIC,
    path.join(SOURCE_PROJECT, 'public'),
    path.join(SOURCE_PROJECT, 'src', 'data'),
  ];
  const stack = [...roots];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(next);
      else if (entry.name.toLowerCase() === basename) return next;
    }
  }
  return null;
}

async function readImage(ref) {
  const localPath = resolveLocal(ref);
  if (localPath) {
    const buffer = fs.readFileSync(localPath);
    if (!buffer.length || buffer.length > MAX_BYTES) throw new Error(`Local image size is invalid: ${localPath}`);
    return { buffer, mimeType: mimeFor(localPath) || 'image/jpeg', resolvedFrom: localPath };
  }
  if (!/^https?:\/\//i.test(ref)) throw new Error(`Local image was not found: ${ref}`);
  const response = await fetch(ref, { redirect: 'follow', signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} while downloading ${ref}`);
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_BYTES) throw new Error(`Remote image exceeds 10 MB: ${ref}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_BYTES) throw new Error(`Remote image size is invalid: ${ref}`);
  const contentType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
  const mimeType = ['image/jpeg', 'image/png', 'image/webp'].includes(contentType) ? contentType : 'image/jpeg';
  return { buffer, mimeType, resolvedFrom: response.url || ref };
}

function publicIdFor(hash) {
  return `dunas-travel/catalog/${hash}`;
}

function uploadBuffer(buffer, mimeType, publicId) {
  const upload = new Promise((resolve, reject) => {
    const options = {
      public_id: publicId,
      resource_type: 'image',
      overwrite: false,
      unique_filename: false,
      use_filename: false,
      format: 'webp',
      eager: [{ width: 1920, crop: 'limit', format: 'webp', quality: 'auto' }],
      eager_async: false,
      chunk_size: 5 * 1024 * 1024,
      tags: ['dunas-travel', 'catalog-import'],
    };
    const stream = cloudinary.uploader.upload_chunked_stream(options, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
    stream.end(buffer);
  });
  return Promise.race([
    upload,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Cloudinary upload timeout for ${publicId}`)), 180_000)),
  ]);
}

async function getOrUploadAsset(buffer, mimeType, hash, existingByPublicId) {
  const publicId = publicIdFor(hash);
  const existingDb = existingByPublicId.get(publicId);
  if (existingDb) return existingDb;

  let result;
  try {
    result = await uploadBuffer(buffer, mimeType, publicId);
  } catch (error) {
    const message = String(error?.message || error);
    if (!/already exists|conflict|duplicate/i.test(message)) throw error;
    result = await cloudinary.api.resource(publicId, { resource_type: 'image' });
  }
  return {
    publicId,
    url: result.url || result.secure_url,
    secureUrl: result.secure_url,
    providerName: 'cloudinary',
    format: result.format || 'webp',
    mimeType,
    bytes: Number(result.bytes || buffer.length),
    width: result.width || null,
    height: result.height || null,
    entityType: MediaEntityType.GENERAL,
    entityId: null,
    provenance: MediaProvenance.SEEDED,
    altText: null,
    uploadedBy: null,
  };
}

function addRef(map, key, ref) {
  const normalized = normalizeRef(ref);
  if (!normalized) return;
  if (!map.has(key)) map.set(key, []);
  if (!map.get(key).some((item) => item.ref === normalized)) map.get(key).push({ ref: normalized });
}

async function main() {
  const catalog = readCatalog();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured');
  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const report = {
    mode: isExecute ? 'execute' : 'dry-run',
    catalogTours: catalog.length,
    sourceImageRefs: 0,
    databaseTourImageRefs: 0,
    destinationHeroRefs: 0,
    uniqueImageRefs: 0,
    uniqueContentHashes: 0,
    uploaded: 0,
    reused: 0,
    tourImagesRewritten: 0,
    destinationHeroesRewritten: 0,
    duplicateTourImagesRemoved: 0,
    unavailableSkipped: 0,
    destinationHeroesCleared: 0,
    errors: [],
    generatedAt: new Date().toISOString(),
  };

  try {
    const [dbTours, landingPages, mediaAssets] = await Promise.all([
      prisma.tour.findMany({ where: { deletedAt: null }, include: { images: { orderBy: { sortOrder: 'asc' } } } }),
      prisma.tourLandingPage.findMany({ where: { deletedAt: null }, select: { id: true, slug: true, heroImageUrl: true } }),
      prisma.mediaAsset.findMany({ where: { deletedAt: null }, select: { id: true, publicId: true, url: true, secureUrl: true, providerName: true, format: true, mimeType: true, bytes: true, width: true, height: true, entityType: true, entityId: true, provenance: true, altText: true, uploadedBy: true } }),
    ]);
    const catalogBySlug = new Map(catalog.map((tour) => [tour.slug, tour]));
    const refsByTour = new Map();
    const landingRefs = new Map();
    for (const tour of catalog) {
      for (const image of tour.images || []) addRef(refsByTour, tour.slug, image.imageUrl);
    }
    report.sourceImageRefs = [...refsByTour.values()].reduce((sum, refs) => sum + refs.length, 0);
    for (const tour of dbTours) {
      for (const image of tour.images || []) addRef(refsByTour, tour.slug, image.imageUrl);
    }
    report.databaseTourImageRefs = dbTours.reduce((sum, tour) => sum + tour.images.length, 0);
    for (const page of landingPages) addRef(landingRefs, page.slug, page.heroImageUrl);
    report.destinationHeroRefs = [...landingRefs.values()].reduce((sum, refs) => sum + refs.length, 0);

    const allRefs = new Map();
    for (const refs of refsByTour.values()) for (const item of refs) allRefs.set(item.ref, item);
    for (const refs of landingRefs.values()) for (const item of refs) allRefs.set(item.ref, item);
    report.uniqueImageRefs = allRefs.size;
    const existingByPublicId = new Map(mediaAssets.map((asset) => [asset.publicId, asset]));
    const byRef = new Map();
    const byHash = new Map();
    const assetByHash = new Map();

    for (const ref of allRefs.keys()) {
      try {
        const image = await readImage(ref);
        const hash = crypto.createHash('sha256').update(image.buffer).digest('hex');
        if (!byHash.has(hash)) {
          byHash.set(hash, { hash, refs: [], image });
          if (isExecute) {
            console.log(`Uploading image ${hash} (${image.buffer.length} bytes)`);
            const asset = await getOrUploadAsset(image.buffer, image.mimeType, hash, existingByPublicId);
            console.log(`Uploaded/reused image ${hash}`);
            const existingAsset = existingByPublicId.get(asset.publicId);
            assetByHash.set(hash, asset);
            if (existingAsset) report.reused++;
            else report.uploaded++;
          }
        }
        byHash.get(hash).refs.push(ref);
        byRef.set(ref, { hash });
      } catch (error) {
        report.errors.push({ ref, message: String(error?.message || error) });
      }
    }
    report.uniqueContentHashes = byHash.size;
    report.unavailableSkipped = report.errors.length;
    if (report.errors.length && !skipUnavailable) {
      fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
      fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
      console.error(JSON.stringify(report, null, 2));
      throw new Error(`Image preflight failed for ${report.errors.length} reference(s)`);
    }
    if (!isExecute) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    for (const [hash, item] of byHash) {
      if (!assetByHash.has(hash)) {
        assetByHash.set(hash, await getOrUploadAsset(item.image.buffer, item.image.mimeType, hash, existingByPublicId));
      }
    }

    const createdAssets = new Map();
    for (const [hash, asset] of assetByHash) {
      const existing = existingByPublicId.get(asset.publicId);
      if (existing) createdAssets.set(hash, existing);
      else {
        const created = await prisma.mediaAsset.create({ data: asset });
        createdAssets.set(hash, created);
        existingByPublicId.set(created.publicId, created);
      }
    }

    for (const tour of dbTours) {
      const refs = refsByTour.get(tour.slug) || [];
      const unique = [];
      const seenHashes = new Set();
      for (const item of refs) {
        const mapped = byRef.get(item.ref);
        if (!mapped || seenHashes.has(mapped.hash)) continue;
        seenHashes.add(mapped.hash);
        unique.push({ hash: mapped.hash, ref: item.ref });
      }
      if (!unique.length) {
        if (refs.length) {
          await prisma.tourImage.deleteMany({ where: { tourId: tour.id } });
          report.duplicateTourImagesRemoved += tour.images.length;
        }
        continue;
      }
      await prisma.$transaction(async (tx) => {
        await tx.tourImage.deleteMany({ where: { tourId: tour.id } });
        await tx.tourImage.createMany({ data: unique.map((item, index) => ({ tourId: tour.id, imageUrl: createdAssets.get(item.hash).secureUrl, isHero: index === 0, altText: null, sortOrder: index })) });
      });
      report.tourImagesRewritten += unique.length;
      report.duplicateTourImagesRemoved += Math.max(0, tour.images.length - unique.length);
    }

    for (const page of landingPages) {
      const item = (landingRefs.get(page.slug) || [])[0];
      if (!item) continue;
      const mapped = byRef.get(item.ref);
      if (!mapped) {
        if (skipUnavailable) {
          await prisma.tourLandingPage.update({ where: { id: page.id }, data: { heroImageUrl: null } });
          report.destinationHeroesCleared++;
        }
        continue;
      }
      await prisma.tourLandingPage.update({ where: { id: page.id }, data: { heroImageUrl: createdAssets.get(mapped.hash).secureUrl } });
      report.destinationHeroesRewritten++;
    }

    const activeTourMedia = await prisma.mediaAsset.findMany({ where: { deletedAt: null, entityType: MediaEntityType.TOUR }, select: { id: true, secureUrl: true } });
    const canonicalUrls = new Set([...createdAssets.values()].map((asset) => asset.secureUrl));
    const obsolete = activeTourMedia.filter((asset) => !canonicalUrls.has(asset.secureUrl));
    if (obsolete.length) {
      await prisma.mediaAsset.updateMany({ where: { id: { in: obsolete.map((asset) => asset.id) }, deletedAt: null }, data: { deletedAt: new Date() } });
    }
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify({ ...report, obsoleteTourMediaSoftDeleted: obsolete.length }, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ ...report, obsoleteTourMediaSoftDeleted: obsolete.length }, null, 2));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
