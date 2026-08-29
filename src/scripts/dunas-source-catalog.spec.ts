import { execFileSync } from 'child_process';
import * as path from 'path';

const SOURCE_DATA_DIRECTORY = path.resolve(
  'D:\\@@project\\LUXURY-PROJECT\\DUNASTRAVEL-private-main\\src\\data',
);

describe('loadDunasSourceCatalog', () => {
  const loadCatalogInNodeProcess = () => JSON.parse(execFileSync(
    process.execPath,
    [
      '-r',
      'ts-node/register',
      'scripts/dunas-source-catalog.ts',
      `--source=${SOURCE_DATA_DIRECTORY}`,
      '--json',
    ],
    {
      cwd: path.resolve(__dirname, '..', '..'),
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    },
  )) as { tours: Array<Record<string, unknown>> };

  const loadNormalizedCatalogInNodeProcess = () => JSON.parse(execFileSync(
    process.execPath,
    [
      '-r',
      'ts-node/register',
      'scripts/dunas-source-catalog.ts',
      `--source=${SOURCE_DATA_DIRECTORY}`,
      '--normalized',
    ],
    {
      cwd: path.resolve(__dirname, '..', '..'),
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    },
  )) as { tours: Array<Record<string, unknown>> };

  it('loads every static source family exactly once', async () => {
    const catalog = loadCatalogInNodeProcess();

    expect(catalog.tours).toHaveLength(55);
    expect(new Set(catalog.tours.map((tour) => tour.slug)).size).toBe(55);
    expect(catalog.tours.filter((tour) => tour.country === 'Egypt')).toHaveLength(12);
    expect(catalog.tours.filter((tour) => tour.country === 'Multi-Country')).toHaveLength(9);
  });

  it('keeps source ownership metadata for source-specific detail adapters', async () => {
    const catalog = loadCatalogInNodeProcess();

    expect(catalog.tours.find((tour) => tour.slug === 'complete-egypt-8d')).toMatchObject({
      sourceFamily: 'base',
      category: 'Complete Egypt Tour',
      country: 'Egypt',
      destinationSlug: 'egypt',
    });
    expect(
      catalog.tours.find((tour) => tour.slug === 'essences-of-egypt-and-turkey-15-days'),
    ).toMatchObject({
      sourceFamily: 'multi-country',
      country: 'Multi-Country',
      destinationSlug: 'multi-country',
    });
  });

  it('resolves multi-country detail keys and preserves source detail fields', () => {
    const catalog = loadNormalizedCatalogInNodeProcess();
    const tour = catalog.tours.find((item) => item.slug === 'essences-of-egypt-and-turkey-15-days');

    expect(tour).toMatchObject({ country: 'Multi-Country', category: 'Multi-Country' });
    expect(tour?.itinerary).toHaveLength(15);
    expect((tour?.itinerary as Array<{ descriptionJsonb: { en: string } }>)[0].descriptionJsonb.en)
      .not.toMatch(/^mct003\./);
    expect((tour?.sourceCodeJsonb as Record<string, unknown>).inclusionsTitle).toBe('mct003.priceIncl');
  });

  it('imports the three Egypt-only static detail records from ahmedData', () => {
    const catalog = loadNormalizedCatalogInNodeProcess();
    const egyptOnlySlugs = [
      'journey-of-the-holy-family-10-days',
      'hurghada-escape',
      'sharm-el-sheikh-escape',
    ];

    for (const slug of egyptOnlySlugs) {
      const tour = catalog.tours.find((item) => item.slug === slug);
      expect((tour?.titleJsonb as { en: string }).en).toBeTruthy();
      expect(tour?.itinerary).toEqual(expect.any(Array));
      expect((tour?.sourceCodeJsonb as Record<string, unknown>).sourceFamily).toBe('additional-egypt');
    }
  });
});
