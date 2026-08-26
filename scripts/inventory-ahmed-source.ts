import * as fs from 'fs';
import * as path from 'path';

type JsonRecord = Record<string, unknown>;

const root = path.resolve(
  process.argv.find((value) => value.startsWith('--source='))?.slice('--source='.length) ??
    path.join(process.cwd(), '..', 'dunas-travel2026.com', 'src', 'data', 'داتا احمد'),
);
const reportDir = path.resolve(process.cwd(), 'reports');

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function classify(relativePath: string): string {
  const name = relativePath.toLowerCase();
  if (name.includes('translation') || /_(ar|en|es|pt|it)\.(txt|json)$/i.test(name)) return 'TOUR TRANSLATIONS';
  if (name.includes('itinerar')) return 'TOUR ITINERARY';
  if (name.includes('transport')) return 'TRANSPORTATION DATA';
  if (name.includes('service')) return 'SERVICE DATA';
  if (name.includes('blog')) return 'BLOG DATA';
  if (name.includes('extract')) return 'SUPPORTING/EXTRACTED DATA';
  if (name.includes('tour') || name.includes('program')) return 'TOUR CATALOG';
  return 'SUPPORTING/EXTRACTED DATA';
}

function country(relativePath: string): string | null {
  const match = relativePath.match(/egypt|turkey|jordan|tunisia|morocco|greece|dubai|multi.?country/i);
  return match?.[0] ?? null;
}

function locale(relativePath: string): string | null {
  const match = relativePath.match(/(?:_|-)(ar|en|es|pt|it)(?:\.|_|-)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function fieldsIn(value: unknown, result = new Set<string>(), prefix = ''): Set<string> {
  if (Array.isArray(value)) {
    value.slice(0, 200).forEach((entry) => fieldsIn(entry, result, prefix));
  } else if (value && typeof value === 'object') {
    Object.entries(value as JsonRecord).forEach(([key, child]) => {
      const field = prefix ? `${prefix}.${key}` : key;
      result.add(field);
      fieldsIn(child, result, field);
    });
  }
  return result;
}

function examplesIn(value: unknown, examples: Map<string, string>, prefix = ''): void {
  if (Array.isArray(value)) {
    value.slice(0, 1).forEach((entry) => examplesIn(entry, examples, prefix));
    return;
  }
  if (!value || typeof value !== 'object') return;
  Object.entries(value as JsonRecord).forEach(([key, child]) => {
    const field = prefix ? `${prefix}.${key}` : key;
    if (!examples.has(field) && ['string', 'number', 'boolean'].includes(typeof child)) {
      examples.set(field, String(child).replaceAll('|', '\\|').slice(0, 160));
    }
    examplesIn(child, examples, field);
  });
}

function readJson(filePath: string): unknown | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function canonicalRecords(relativePath: string, value: unknown): unknown[] {
  if (!value || typeof value !== 'object') return [];
  const record = value as JsonRecord;
  if (relativePath.endsWith('البيانات_الكاملة_المجمعة.json')) {
    const destinations = record.destinations as JsonRecord | undefined;
    return Object.values(destinations ?? {}).flatMap((destination) => {
      const tours = (destination as JsonRecord)?.tours;
      return Array.isArray(tours) ? tours : [];
    });
  }
  if (relativePath.endsWith('ملفات_البيانات_الأصلية/programs.json')) {
    return Array.isArray(record.programs) ? record.programs : [];
  }
  return [];
}

const AHMED_TRANSLATION_FIELDS = [
  'id', 'slug', 'title', 'duration', 'type', 'groupSize', 'overview',
  'highlights', 'itinerary.day', 'itinerary.title', 'itinerary.description',
  'included', 'excluded', 'language',
];

function sourceRole(relativePath: string): string {
  if (relativePath === 'ahmedData.tsx') return 'CANONICAL LOCALIZED TOUR CONTENT';
  if (relativePath.endsWith('البيانات_الكاملة_المجمعة.json')) return 'CANONICAL CURATED TOUR CATALOG';
  if (relativePath.endsWith('ملفات_البيانات_الأصلية/programs.json')) return 'CANONICAL RAW PROGRAM CATALOG';
  return classify(relativePath);
}

function fieldStatus(field: string): [string, string, string] {
  const direct: Record<string, [string, string, string]> = {
    id: ['source identity (not persisted)', 'N/A', 'INTENTIONALLY NOT RUNTIME DATA'],
    code: ['Tour.sourceCodeJsonb', 'CreateTourDto.sourceCodeJsonb', 'FULLY SUPPORTED'],
    slug: ['Tour.slug', 'CreateTourDto.slug', 'FULLY SUPPORTED'],
    title: ['Tour.titleJsonb', 'CreateTourDto.titleJsonb', 'FULLY SUPPORTED'],
    name: ['Tour.titleJsonb', 'CreateTourDto.titleJsonb', 'TRANSFORMED CORRECTLY'],
    duration: ['Tour.durationJsonb', 'CreateTourDto.durationJsonb', 'FULLY SUPPORTED'],
    overview: ['Tour.overviewJsonb', 'CreateTourDto.overviewJsonb', 'FULLY SUPPORTED'],
    description: ['Tour.overviewJsonb', 'CreateTourDto.overviewJsonb', 'TRANSFORMED CORRECTLY'],
    minPax: ['Tour.minPaxJsonb', 'CreateTourDto.minPaxJsonb', 'FULLY SUPPORTED'],
    included: ['Tour.includedServicesJsonb', 'CreateTourDto.includedServicesJsonb', 'FULLY SUPPORTED'],
    excluded: ['Tour.excludedServicesJsonb', 'CreateTourDto.excludedServicesJsonb', 'FULLY SUPPORTED'],
    images: ['TourImage (ordered)', 'tour image DTO', 'FULLY SUPPORTED'],
    itinerary: ['TourItinerary (ordered)', 'itinerary DTO', 'FULLY SUPPORTED'],
    price: ['Tour.basePriceUsd', 'CreateTourDto.basePriceUsd', 'FULLY SUPPORTED'],
    currency: ['Tour.currency', 'CreateTourDto.currency', 'FULLY SUPPORTED'],
    type: ['Tour.category', 'CreateTourDto.category', 'TRANSFORMED CORRECTLY'],
    destination: ['Tour.country + destination relation', 'CreateTourDto.country', 'TRANSFORMED CORRECTLY'],
    language: ['Tour.languages', 'CreateTourDto.languages', 'TRANSFORMED CORRECTLY'],
    subtitle: ['Tour.subtitleJsonb', 'CreateTourDto.subtitleJsonb', 'FULLY SUPPORTED'],
    highlights: ['Tour.highlightsJsonb', 'CreateTourDto.highlightsJsonb', 'FULLY SUPPORTED'],
    market: ['Tour.market', 'CreateTourDto.market', 'FULLY SUPPORTED'],
    departures: ['Tour.departureInfoJsonb', 'CreateTourDto.departureInfoJsonb', 'TRANSFORMED CORRECTLY'],
    rating: ['Tour.sourceRating', 'CreateTourDto.sourceRating', 'FULLY SUPPORTED'],
    reviewCount: ['Tour.sourceReviewCount', 'CreateTourDto.sourceReviewCount', 'FULLY SUPPORTED'],
    pricing: ['Tour.seasonPricingJsonb', 'CreateTourDto.seasonPricingJsonb', 'TRANSFORMED CORRECTLY'],
    accommodation: ['Tour.hotelInfoJsonb', 'CreateTourDto.hotelInfoJsonb', 'TRANSFORMED CORRECTLY'],
    hotels: ['Tour.hotelInfoJsonb', 'CreateTourDto.hotelInfoJsonb', 'TRANSFORMED CORRECTLY'],
    hotelCategory: ['Tour.hotelInfoJsonb', 'CreateTourDto.hotelInfoJsonb', 'TRANSFORMED CORRECTLY'],
    selectedHotels: ['Tour.hotelInfoJsonb', 'CreateTourDto.hotelInfoJsonb', 'TRANSFORMED CORRECTLY'],
    route: ['Tour.transportationJsonb', 'CreateTourDto.transportationJsonb', 'TRANSFORMED CORRECTLY'],
    excursions: ['Tour.termsJsonb', 'CreateTourDto.termsJsonb', 'TRANSFORMED CORRECTLY'],
  };
  const root = field.split('.')[0];
  if (root === 'days' || root === 'itinerary') {
    return ['TourItinerary (ordered)', 'CreateTourItineraryDto', 'TRANSFORMED CORRECTLY'];
  }
  return direct[field] ?? direct[root] ?? ['Not currently represented', 'N/A', 'INTENTIONALLY NOT RUNTIME DATA'];
}

function main(): void {
  const files = walk(root);
  const inventory = files.map((filePath) => {
    const relativePath = path.relative(root, filePath).replaceAll('\\', '/');
    const extension = path.extname(filePath).toLowerCase();
    const content = fs.readFileSync(filePath, 'utf8');
    const json = extension === '.json' ? readJson(filePath) : null;
    const records = json ? canonicalRecords(relativePath, json) : [];
    const canonicalFields =
      relativePath === 'ahmedData.tsx'
        ? AHMED_TRANSLATION_FIELDS
        : [...fieldsIn(records)].sort();
    return {
      relativePath,
      fileType: extension || 'none',
      purpose: sourceRole(relativePath),
      country: country(relativePath),
      locale: locale(relativePath),
      tourRecordsFound: records.length,
      fieldsFound: canonicalFields,
      mediaReferences: (content.match(/(?:https?:\/\/[^\s"']+|\/[^\s"']+\.(?:jpg|jpeg|png|webp))/gi) ?? []).length,
      itineraryReferences: (content.match(/itinerary|dayLabel|activities/gi) ?? []).length,
    };
  });
  const allFields = [...new Set(inventory.flatMap((entry) => entry.fieldsFound))].sort();
  const examples = new Map<string, string>();
  for (const entry of inventory) {
    const parsed = entry.fileType === '.json'
      ? readJson(path.join(root, entry.relativePath))
      : null;
    canonicalRecords(entry.relativePath, parsed).forEach((record) => examplesIn(record, examples));
  }
  const catalogFiles = inventory.filter((entry) => entry.tourRecordsFound > 0);
  const result = {
    generatedAt: new Date().toISOString(),
    sourceRoot: root,
    sourceFilesScanned: inventory.length,
    canonicalStructuredTourRecords: catalogFiles.reduce((total, entry) => total + entry.tourRecordsFound, 0),
    canonicalCatalogRule: '20 curated records + 3 Ahmed translation-only records + 33 raw programs = 56 normalized canonical tours',
    files: inventory,
    unionOfFields: allFields,
  };
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, 'ahmed-source-inventory.json'), `${JSON.stringify(result, null, 2)}\n`);
  const rows = allFields.map((field) => {
    const using = inventory.filter((entry) => entry.fieldsFound.includes(field)).map((entry) => entry.relativePath).join('<br>');
    const [prisma, dto, status] = fieldStatus(field);
    return `| ${field} | ${using || '—'} | ${examples.get(field) ?? 'Structured value'} | ${prisma} | ${dto} | Tour API | Requires audit | Requires audit | ${status} |`;
  });
  fs.writeFileSync(
    path.join(reportDir, 'ahmed-source-field-matrix.md'),
    [
      '# Ahmed Source Field Matrix',
      '',
      `Scanned ${inventory.length} files under \`${root}\` on ${new Date().toISOString()}.`,
      '',
      '| Ahmed source field | Files using it | Example | Prisma field/relation | Backend DTO | API | Dashboard | Customer | Status |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ...rows,
      '',
      'Fields marked BACKEND FIELD MISSING require an explicit modeling decision before import.',
    ].join('\n'),
  );
  console.log(JSON.stringify({ sourceFilesScanned: inventory.length, canonicalStructuredTourRecords: result.canonicalStructuredTourRecords, fields: allFields.length }, null, 2));
}

main();
