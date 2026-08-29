import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import {
  buildDunasSourceClassifications,
  sourceSlug,
  type DunasSourceCatalog as ClassificationCatalog,
  type DunasSourceTour,
} from './dunas-source-classification';

export type DunasSourceFamily = 'base' | 'turkey' | 'jordan' | 'dubai' | 'multi-country' | 'additional-egypt';

export interface DunasRawCatalogTour extends DunasSourceTour {
  sourceFamily: DunasSourceFamily;
  slug: string;
  country: string;
  category: string;
  destinationSlug: string;
}

export interface DunasRawCatalog {
  tours: DunasRawCatalogTour[];
}

type SupportedLocale = 'ar' | 'en' | 'es' | 'pt' | 'it';
type LocalizedText = Partial<Record<SupportedLocale, string>>;
type LocalizedList = Partial<Record<SupportedLocale, string[]>>;
type UnknownRecord = Record<string, unknown>;

export interface NormalizedDunasItineraryDay {
  dayLabel: string | null;
  descriptionJsonb: LocalizedText;
  mealsJsonb: LocalizedText | null;
  sortOrder: number;
}

export interface NormalizedDunasSourceTour {
  slug: string;
  sourceCatalogId: string | null;
  country: string;
  category: string;
  destinationSlug: string;
  titleJsonb: LocalizedText;
  subtitleJsonb: LocalizedText;
  durationJsonb: LocalizedText;
  overviewJsonb: LocalizedText;
  highlightsJsonb: LocalizedList;
  includedServicesJsonb: LocalizedList;
  excludedServicesJsonb: LocalizedList;
  minPaxJsonb: LocalizedText;
  departureInfoJsonb: LocalizedText;
  hotelInfoJsonb: UnknownRecord | null;
  sourceCodeJsonb: UnknownRecord;
  images: Array<{ imageUrl: string; altText: string | null; sortOrder: number }>;
  itinerary: NormalizedDunasItineraryDay[];
}

interface SourceModule {
  [name: string]: unknown;
}

const ADDITIONAL_EGYPT_CONFIG = [
  { groupIndex: 9, slug: 'journey-of-the-holy-family-10-days', category: 'Religious' },
  { groupIndex: 18, slug: 'hurghada-escape', category: 'Beach' },
  { groupIndex: 19, slug: 'sharm-el-sheikh-escape', category: 'Beach' },
];

interface AhmedSourceRecord {
  language: SupportedLocale;
  title: string;
  duration: string;
  overview: string;
  highlights: string[];
  itinerary: Array<{ day: number; title: string; description: string }>;
  included: string[];
  excluded: string[];
}

const nativeImport = new Function('specifier', 'return import(specifier);') as (
  specifier: string,
) => Promise<SourceModule>;

const LOCALES: SupportedLocale[] = ['ar', 'en', 'es', 'pt', 'it'];

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getByPath(dictionary: UnknownRecord, key: string): unknown {
  if (key in dictionary) return dictionary[key];
  return key.split('.').reduce<unknown>((value, segment) => isRecord(value) ? value[segment] : undefined, dictionary);
}

function resolveText(value: unknown, locale: SupportedLocale, dictionaries: Record<SupportedLocale, UnknownRecord>): string {
  if (typeof value !== 'string') return '';
  return String(getByPath(dictionaries[locale], `data.${value}`) ?? value);
}

function localizedText(value: unknown, dictionaries: Record<SupportedLocale, UnknownRecord>): LocalizedText {
  if (isRecord(value)) {
    return Object.fromEntries(LOCALES.map((locale) => [locale, resolveText(value[locale] ?? value.en, locale, dictionaries)])) as LocalizedText;
  }
  return Object.fromEntries(LOCALES.map((locale) => [locale, resolveText(value, locale, dictionaries)])) as LocalizedText;
}

function localizedList(value: unknown, dictionaries: Record<SupportedLocale, UnknownRecord>): LocalizedList {
  const rawByLocale = isRecord(value) ? value : undefined;
  return Object.fromEntries(LOCALES.map((locale) => {
    const selected = rawByLocale ? rawByLocale[locale] ?? rawByLocale.en : value;
    const list = Array.isArray(selected) ? selected : [];
    return [locale, list.map((item) => resolveText(item, locale, dictionaries)).filter(Boolean)];
  })) as LocalizedList;
}

function sourceRecord(tour: DunasRawCatalogTour): UnknownRecord {
  return tour as unknown as UnknownRecord;
}

function sourceList(tour: DunasRawCatalogTour, primary: string, alternate?: string): unknown {
  const source = sourceRecord(tour);
  return source[primary] ?? (alternate ? source[alternate] : undefined);
}

function normalizeImages(tour: DunasRawCatalogTour): NormalizedDunasSourceTour['images'] {
  const source = sourceRecord(tour);
  const imageValues = Array.isArray(source.images)
    ? source.images
    : typeof source.heroImage === 'string' ? [source.heroImage] : [];
  return imageValues
    .filter((image): image is string => typeof image === 'string' && image.trim().length > 0)
    .map((imageUrl, sortOrder) => ({ imageUrl, altText: null, sortOrder }));
}

function normalizeItinerary(
  tour: DunasRawCatalogTour,
  dictionaries: Record<SupportedLocale, UnknownRecord>,
): NormalizedDunasItineraryDay[] {
  const source = sourceRecord(tour);
  if (isRecord(source.translatedItinerary)) {
    const byLocale = source.translatedItinerary as Partial<Record<SupportedLocale, unknown>>;
    const maxDays = Math.max(...LOCALES.map((locale) => Array.isArray(byLocale[locale]) ? byLocale[locale].length : 0));
    return Array.from({ length: maxDays }, (_, sortOrder) => {
      const localizedDay = (field: 'title' | 'description'): LocalizedText => Object.fromEntries(
        LOCALES.map((locale) => {
          const day = Array.isArray(byLocale[locale]) ? byLocale[locale][sortOrder] : undefined;
          return [locale, isRecord(day) && typeof day[field] === 'string' ? day[field] : ''];
        }),
      ) as LocalizedText;
      const title = localizedDay('title');
      return {
        dayLabel: title.en?.trim() || null,
        descriptionJsonb: localizedDay('description'),
        mealsJsonb: null,
        sortOrder,
      };
    });
  }
  const items = Array.isArray(source.days) ? source.days : Array.isArray(source.itinerary) ? source.itinerary : [];
  return items.filter(isRecord).map((item, sortOrder) => {
    const title = localizedText(item.title, dictionaries);
    return {
      dayLabel: title.en?.trim() || null,
      descriptionJsonb: localizedText(item.description, dictionaries),
      mealsJsonb: Object.values(localizedText(item.meals, dictionaries)).some(Boolean)
        ? localizedText(item.meals, dictionaries)
        : null,
      sortOrder,
    };
  });
}

function readDictionaries(sourceDirectory: string): Record<SupportedLocale, UnknownRecord> {
  const localeDirectory = path.resolve(sourceDirectory, '..', 'i18n', 'locales');
  return Object.fromEntries(LOCALES.map((locale) => {
    const filePath = path.join(localeDirectory, `${locale}.json`);
    return [locale, JSON.parse(fs.readFileSync(filePath, 'utf8')) as UnknownRecord];
  })) as Record<SupportedLocale, UnknownRecord>;
}

function parseAhmedGroups(sourceDirectory: string): AhmedSourceRecord[][] {
  const filePath = path.join(sourceDirectory, 'ahmedData.tsx');
  const source = fs.readFileSync(filePath, 'utf8');
  const declaration = source.indexOf('export const ahmedToursData');
  const start = source.indexOf('= [', declaration) + 2;
  const end = source.indexOf('];', start) + 1;
  if (declaration < 0 || start < 2 || end <= start) throw new Error(`Unable to parse ${filePath}`);
  const records = JSON.parse(source.slice(start, end)) as AhmedSourceRecord[];
  const groups: AhmedSourceRecord[][] = [];
  let current: AhmedSourceRecord[] = [];
  let seenLocales = new Set<SupportedLocale>();
  for (const record of records) {
    if (seenLocales.has(record.language)) {
      groups.push(current);
      current = [];
      seenLocales = new Set<SupportedLocale>();
    }
    current.push(record);
    seenLocales.add(record.language);
  }
  if (current.length) groups.push(current);
  if (groups.length !== 20) throw new Error(`Expected 20 ahmedData groups, received ${groups.length}`);
  return groups;
}

function localizedAhmedValue<T>(group: AhmedSourceRecord[], field: keyof AhmedSourceRecord): Partial<Record<SupportedLocale, T>> {
  return Object.fromEntries(group.map((record) => [record.language, record[field] as T])) as Partial<Record<SupportedLocale, T>>;
}

function loadAdditionalEgyptTours(sourceDirectory: string): DunasSourceTour[] {
  const groups = parseAhmedGroups(sourceDirectory);
  return ADDITIONAL_EGYPT_CONFIG.map((config) => {
    const group = groups[config.groupIndex];
    if (!group?.length) throw new Error(`Missing ahmedData group ${config.groupIndex + 1}`);
    return {
      id: `ahmed-group-${config.groupIndex + 1}`,
      slug: config.slug,
      category: config.category,
      title: localizedAhmedValue<string>(group, 'title'),
      duration: localizedAhmedValue<string>(group, 'duration'),
      overview: localizedAhmedValue<string>(group, 'overview'),
      highlights: localizedAhmedValue<string[]>(group, 'highlights'),
      included: localizedAhmedValue<string[]>(group, 'included'),
      excluded: localizedAhmedValue<string[]>(group, 'excluded'),
      translatedItinerary: localizedAhmedValue<AhmedSourceRecord['itinerary']>(group, 'itinerary'),
    } as DunasSourceTour;
  });
}

async function readArrayExport(
  sourceDirectory: string,
  fileName: string,
  exportName: string,
): Promise<DunasSourceTour[]> {
  const sourcePath = path.join(sourceDirectory, fileName);
  const module = await nativeImport(pathToFileURL(sourcePath).href);
  const value = module[exportName];
  if (!Array.isArray(value)) throw new Error(`Expected array export '${exportName}' in ${sourcePath}`);
  return value as DunasSourceTour[];
}

function appendFamily(
  output: DunasRawCatalogTour[],
  family: DunasSourceFamily,
  rows: DunasSourceTour[],
  classifications: Map<string, ReturnType<typeof buildDunasSourceClassifications>[number]>,
): void {
  for (const row of rows) {
    const slug = sourceSlug(row);
    const classification = classifications.get(slug);
    if (!classification) throw new Error(`Missing classification for ${slug}`);
    output.push({ ...row, ...classification, slug, sourceFamily: family });
  }
}

export async function loadDunasSourceCatalog(sourceDirectory: string): Promise<DunasRawCatalog> {
  if (!fs.existsSync(sourceDirectory)) throw new Error(`DUNASTRAVEL source directory does not exist: ${sourceDirectory}`);

  const [baseTours, turkeyTours, jordanTours, dubaiTours, multiCountryTours] = await Promise.all([
    readArrayExport(sourceDirectory, 'tours.js', 'tours'),
    readArrayExport(sourceDirectory, 'turkeyTours.js', 'turkeyTours'),
    readArrayExport(sourceDirectory, 'jordanTours.js', 'jordanTours'),
    readArrayExport(sourceDirectory, 'dubaiTours.js', 'dubaiTours'),
    readArrayExport(sourceDirectory, 'multiCountryTours.js', 'multiCountryTours'),
  ]);
  const additionalEgyptTours = loadAdditionalEgyptTours(sourceDirectory);
  const classificationCatalog: ClassificationCatalog = {
    baseTours,
    turkeyTours,
    jordanTours,
    dubaiTours,
    multiCountryTours,
    additionalEgyptTours: additionalEgyptTours as Array<{ slug: string; category: string }>,
  };
  const classifications = new Map(
    buildDunasSourceClassifications(classificationCatalog).map((item) => [item.slug, item]),
  );
  const tours: DunasRawCatalogTour[] = [];
  appendFamily(tours, 'base', baseTours, classifications);
  appendFamily(tours, 'turkey', turkeyTours, classifications);
  appendFamily(tours, 'jordan', jordanTours, classifications);
  appendFamily(tours, 'dubai', dubaiTours, classifications);
  appendFamily(tours, 'multi-country', multiCountryTours, classifications);
  appendFamily(tours, 'additional-egypt', additionalEgyptTours, classifications);

  if (tours.length !== 55 || new Set(tours.map((tour) => tour.slug)).size !== tours.length) {
    throw new Error(`Expected 55 unique source tours, received ${tours.length}`);
  }
  return { tours };
}

export async function normalizeDunasSourceCatalog(sourceDirectory: string): Promise<{ tours: NormalizedDunasSourceTour[] }> {
  const [catalog, dictionaries] = await Promise.all([
    loadDunasSourceCatalog(sourceDirectory),
    Promise.resolve(readDictionaries(sourceDirectory)),
  ]);
  return {
    tours: catalog.tours.map((tour) => {
      const source = sourceRecord(tour);
      const title = source.title ?? source.name;
      const hotelInfo = Object.fromEntries(['selectedHotels', 'hotels', 'hotelCategory']
        .filter((key) => source[key] !== undefined)
        .map((key) => [key, source[key]]));
      return {
        slug: tour.slug,
        sourceCatalogId: typeof source.id === 'string' ? source.id : null,
        country: tour.country,
        category: tour.category,
        destinationSlug: tour.destinationSlug,
        titleJsonb: localizedText(title, dictionaries),
        subtitleJsonb: localizedText(source.subtitle, dictionaries),
        durationJsonb: localizedText(source.duration, dictionaries),
        overviewJsonb: localizedText(source.overview ?? source.description, dictionaries),
        highlightsJsonb: localizedList(source.highlights, dictionaries),
        includedServicesJsonb: localizedList(sourceList(tour, 'included', 'includes'), dictionaries),
        excludedServicesJsonb: localizedList(sourceList(tour, 'excluded', 'excludes'), dictionaries),
        minPaxJsonb: localizedText(source.minPax, dictionaries),
        departureInfoJsonb: localizedText(source.departures, dictionaries),
        hotelInfoJsonb: Object.keys(hotelInfo).length > 0 ? hotelInfo : null,
        sourceCodeJsonb: source,
        images: normalizeImages(tour),
        itinerary: normalizeItinerary(tour, dictionaries),
      };
    }),
  };
}

function argumentValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const sourceDirectory = path.resolve(
    argumentValue('source')
      ?? path.join(process.cwd(), '..', 'DUNASTRAVEL-private-main', 'src', 'data'),
  );
  const catalog = process.argv.includes('--normalized')
    ? await normalizeDunasSourceCatalog(sourceDirectory)
    : await loadDunasSourceCatalog(sourceDirectory);
  console.log(JSON.stringify(catalog));
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
