import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  buildDunasSourceClassifications,
  type DunasSourceTour,
} from './dunas-source-classification';

const EXPECTED_TOUR_COUNT = 55;
const ADDITIONAL_EGYPT_TOURS = [
  { slug: 'journey-of-the-holy-family-10-days', category: 'Religious' },
  { slug: 'hurghada-escape', category: 'Beach' },
  { slug: 'sharm-el-sheikh-escape', category: 'Beach' },
];

interface SourceModule {
  [name: string]: unknown;
}

interface ReconciliationChange {
  slug: string;
  countryChanged: boolean;
  categoryChanged: boolean;
  destinationRelationChanged: boolean;
}

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

/** Use native dynamic import so ESM data modules load from the source project. */
const nativeImport = new Function(
  'specifier',
  'return import(specifier);',
) as (specifier: string) => Promise<SourceModule>;

async function readArrayExport(
  sourceDirectory: string,
  fileName: string,
  exportName: string,
): Promise<DunasSourceTour[]> {
  const sourcePath = path.join(sourceDirectory, fileName);
  const module = await nativeImport(pathToFileURL(sourcePath).href);
  const value = module[exportName];
  if (!Array.isArray(value)) {
    throw new Error(`Expected array export '${exportName}' in ${sourcePath}`);
  }
  return value as DunasSourceTour[];
}

async function loadSourceClassifications(sourceDirectory: string) {
  if (!fs.existsSync(sourceDirectory)) {
    throw new Error(`DUNASTRAVEL source directory does not exist: ${sourceDirectory}`);
  }
  const [baseTours, turkeyTours, jordanTours, dubaiTours, multiCountryTours] = await Promise.all([
    readArrayExport(sourceDirectory, 'tours.js', 'tours'),
    readArrayExport(sourceDirectory, 'turkeyTours.js', 'turkeyTours'),
    readArrayExport(sourceDirectory, 'jordanTours.js', 'jordanTours'),
    readArrayExport(sourceDirectory, 'dubaiTours.js', 'dubaiTours'),
    readArrayExport(sourceDirectory, 'multiCountryTours.js', 'multiCountryTours'),
  ]);
  const classifications = buildDunasSourceClassifications({
    baseTours,
    turkeyTours,
    jordanTours,
    dubaiTours,
    multiCountryTours,
    additionalEgyptTours: ADDITIONAL_EGYPT_TOURS,
  });
  if (classifications.length !== EXPECTED_TOUR_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_TOUR_COUNT} DUNASTRAVEL tours, received ${classifications.length}`,
    );
  }
  return classifications;
}

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute');
  const sourceDirectory = path.resolve(
    argValue('source') ?? path.join(process.cwd(), '..', 'DUNASTRAVEL-private-main', 'src', 'data'),
  );
  const reportPath = argValue('report') ? path.resolve(argValue('report')!) : undefined;
  const classifications = await loadSourceClassifications(sourceDirectory);
  const prisma = new PrismaService();

  try {
    const slugs = classifications.map((item) => item.slug);
    const [tours, destinationPages] = await Promise.all([
      prisma.tour.findMany({
        where: { slug: { in: slugs }, deletedAt: null },
        select: {
          id: true,
          slug: true,
          country: true,
          category: true,
          landingPages: {
            where: { landingPage: { type: 'DESTINATION', deletedAt: null } },
            select: { landingPageId: true, landingPage: { select: { slug: true } } },
          },
        },
      }),
      prisma.tourLandingPage.findMany({
        where: {
          type: 'DESTINATION',
          deletedAt: null,
          slug: { in: [...new Set(classifications.map((item) => item.destinationSlug))] },
        },
        select: { id: true, slug: true },
      }),
    ]);
    const tourBySlug = new Map(tours.map((tour) => [tour.slug, tour]));
    const pageBySlug = new Map(destinationPages.map((page) => [page.slug, page]));
    const missingTours = slugs.filter((slug) => !tourBySlug.has(slug));
    const missingLandingPages = [...new Set(classifications.map((item) => item.destinationSlug))]
      .filter((slug) => !pageBySlug.has(slug));

    if (missingTours.length || missingLandingPages.length) {
      throw new Error(JSON.stringify({ missingTours, missingLandingPages }));
    }

    const changes: ReconciliationChange[] = [];
    for (const expected of classifications) {
      const current = tourBySlug.get(expected.slug)!;
      const targetPage = pageBySlug.get(expected.destinationSlug)!;
      const currentDestinationSlugs = current.landingPages.map((link) => link.landingPage.slug);
      const destinationRelationChanged =
        currentDestinationSlugs.length !== 1 || currentDestinationSlugs[0] !== expected.destinationSlug;
      const change = {
        slug: expected.slug,
        countryChanged: current.country !== expected.country,
        categoryChanged: current.category !== expected.category,
        destinationRelationChanged,
      };
      if (change.countryChanged || change.categoryChanged || change.destinationRelationChanged) {
        changes.push(change);
      }

      if (execute && (change.countryChanged || change.categoryChanged || change.destinationRelationChanged)) {
        await prisma.$transaction(async (tx) => {
          if (change.countryChanged || change.categoryChanged) {
            await tx.tour.update({
              where: { id: current.id },
              data: { country: expected.country, category: expected.category },
            });
          }
          if (change.destinationRelationChanged) {
            await tx.tourLandingPageTour.deleteMany({
              where: { tourId: current.id, landingPage: { type: 'DESTINATION' } },
            });
            await tx.tourLandingPageTour.create({
              data: {
                landingPageId: targetPage.id,
                tourId: current.id,
                sortOrder: 0,
                isFeatured: false,
                isVisible: true,
              },
            });
          }
        });
      }
    }

    const report = {
      mode: execute ? 'execute' : 'dry-run',
      sourceDirectory,
      sourceTourCount: classifications.length,
      databaseTourCount: tours.length,
      changes,
      unchanged: classifications.length - changes.length,
      generatedAt: new Date().toISOString(),
    };
    if (reportPath) {
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    }
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.onModuleDestroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
