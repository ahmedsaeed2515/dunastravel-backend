import * as fs from 'fs';
import * as path from 'path';

export const SUPPORTED_LOCALES = ['ar', 'en', 'es', 'pt', 'it'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export type LocalizedText = Partial<Record<SupportedLocale, string>>;
export type LocalizedList = Partial<Record<SupportedLocale, string[]>>;

/** Existing destination landing-page identities used by the runtime catalog. */
export const DESTINATION_SLUG_BY_COUNTRY: Record<string, string> = {
  egypt: 'egypt',
  turkey: 'turkey',
  jordan: 'jordan',
  morocco: 'morocco',
  greece: 'greece',
  tunisia: 'tunisia',
  'united arab emirates': 'dubai',
  'multi-country': 'multi-country',
};

export function destinationSlugForCountry(country: string): string | undefined {
  return DESTINATION_SLUG_BY_COUNTRY[country.trim().toLowerCase()];
}

interface AhmedTour {
  id: string;
  slug: string;
  title: string;
  duration: string;
  type: string;
  groupSize: string;
  overview: string;
  highlights: string[];
  itinerary: Array<{ day: number; title: string; description: string }>;
  included: string[];
  excluded: string[];
  language: SupportedLocale;
}

interface SourceTour {
  id?: string;
  slug?: string;
  language?: string;
  market?: string;
  type?: string;
  subtitle?: string | LocalizedText;
  duration?: string | LocalizedText;
  destination?: string;
  title?: string | LocalizedText;
  name?: string | LocalizedText;
  overview?: string | LocalizedText;
  description?: string | LocalizedText;
  price?: number;
  rating?: number;
  reviewCount?: number;
  departures?: string | LocalizedText;
  code?: string | LocalizedText;
  images?: string[];
  highlights?: string[] | LocalizedList | string | LocalizedText;
  included?: string[] | LocalizedList;
  includes?: string[] | LocalizedList;
  excluded?: string[] | LocalizedList;
  excludes?: string[] | LocalizedList;
  minPax?: string | LocalizedText;
  pricing?: unknown;
  pricingTiers?: unknown;
  optionalExcursionsPricing?: unknown;
  extraNightPrices?: unknown;
  exhibitionSurcharges?: unknown;
  accommodation?: unknown;
  hotels?: unknown;
  hotelCategory?: unknown;
  selectedHotels?: unknown;
  excursions?: unknown;
  route?: unknown;
  transportOptions?: string | LocalizedText;
  days?: SourceItineraryDay[];
  itinerary?: SourceItineraryDay[];
}

interface SourceItineraryDay {
  day?: string | number;
  title?: string | LocalizedText;
  description?: string | LocalizedText;
  meals?: string | LocalizedText;
  activities?: string[] | LocalizedList | string | LocalizedText;
  hotels?: string[] | LocalizedList | string | LocalizedText;
  transportation?: string[] | LocalizedList | string | LocalizedText;
  notes?: string | LocalizedText;
}

interface CombinedSource {
  destinations: Record<
    string,
    { tours?: SourceTour[]; totalTours?: number; destinationName?: string }
  >;
  allProgramsRaw?: SourceTour[];
}

export interface NormalizedItineraryDay {
  dayLabel: string;
  descriptionJsonb: LocalizedText;
  mealsJsonb?: LocalizedText;
  activitiesJsonb?: LocalizedList;
  hotelsJsonb?: LocalizedList;
  transportationJsonb?: LocalizedList;
  notesJsonb?: LocalizedText;
  sortOrder: number;
}

export interface NormalizedTourImage {
  imageUrl: string;
  isHero: boolean;
  altText: string | null;
  sortOrder: number;
}

export interface NormalizedTour {
  sourceId: string;
  sourceCodeJsonb: LocalizedText;
  slug: string;
  titleJsonb: LocalizedText;
  subtitleJsonb: LocalizedText;
  highlightsJsonb: LocalizedList;
  departureInfoJsonb: LocalizedText;
  market: string | null;
  sourceRating: number | null;
  sourceReviewCount: number | null;
  durationJsonb: LocalizedText;
  overviewJsonb: LocalizedText;
  minPaxJsonb: LocalizedText;
  includedServicesJsonb: LocalizedList;
  excludedServicesJsonb: LocalizedList;
  category: string;
  country: string;
  basePriceUsd: number | null;
  currency: 'USD';
  status: 'DRAFT' | 'PUBLISHED';
  isActive: boolean;
  languages: SupportedLocale[];
  tags: string[];
  hotelInfoJsonb: Record<string, unknown> | null;
  seasonPricingJsonb: Record<string, unknown> | null;
  transportationJsonb: Record<string, unknown> | null;
  termsJsonb: Record<string, unknown> | null;
  itineraries: NormalizedItineraryDay[];
  images: NormalizedTourImage[];
}

const CURATED_AHMED_GROUP_BY_SLUG: Record<string, number> = {
  'cairo-express-4d': 0,
  'cairo-express-alexandria-5d': 1,
  'egito-classico-8d': 2,
  'egito-historico-10d': 3,
  'cairo-cruzeiro-sharm-11d': 4,
  'grande-ramses-10d': 5,
  'tesouros-egipto-9d': 6,
  'complete-egypt-8d': 7,
  'egito-classico-ii-9d': 8,
  'estrellas-medio-oriente-19d': 10,
  'cairo-and-athens-11-days': 11,
  'essences-of-egypt-and-turkey-15-days': 12,
  'marvels-of-dubai-and-turkey-14-days': 13,
  'stars-of-the-middle-east-16-days': 14,
  'treasures-of-egypt-and-tunisia-16-days': 15,
  'egypt-and-dubai-13-days': 16,
};

const AHMED_ONLY_GROUPS: Array<{
  index: number;
  slug: string;
  country: string;
  category: string;
}> = [
  {
    index: 9,
    slug: 'journey-of-the-holy-family-10-days',
    country: 'Egypt',
    category: 'Religious',
  },
  { index: 17, slug: 'hurghada-escape', country: 'Egypt', category: 'Beach' },
  {
    index: 18,
    slug: 'sharm-el-sheikh-escape',
    country: 'Egypt',
    category: 'Beach',
  },
];

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function walkFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
}

function findLargestFile(
  files: string[],
  predicate: (filePath: string) => boolean,
): string {
  const matches = files.filter(predicate).sort((left, right) => {
    return fs.statSync(right).size - fs.statSync(left).size;
  });
  if (!matches[0]) throw new Error('Required Ahmed source file was not found');
  return matches[0];
}

function parseAhmedData(filePath: string): AhmedTour[] {
  const source = fs.readFileSync(filePath, 'utf8');
  const declaration = source.indexOf('export const ahmedToursData');
  const start = source.indexOf('= [', declaration) + 2;
  const end = source.indexOf('];', start) + 1;
  if (declaration < 0 || start < 2 || end <= start) {
    throw new Error(`Unable to parse ${filePath}`);
  }
  return JSON.parse(source.slice(start, end)) as AhmedTour[];
}

export function groupAhmedTranslations(records: AhmedTour[]): AhmedTour[][] {
  const groups: AhmedTour[][] = [];
  let current: AhmedTour[] = [];
  let locales = new Set<SupportedLocale>();

  for (const record of records) {
    if (locales.has(record.language)) {
      const duplicate = current.some(
        (item) =>
          item.language === record.language &&
          item.slug === record.slug &&
          item.title === record.title,
      );
      if (duplicate) continue;
      groups.push(current);
      current = [];
      locales = new Set<SupportedLocale>();
    }
    current.push(record);
    locales.add(record.language);
    if (locales.size === SUPPORTED_LOCALES.length) {
      groups.push(current);
      current = [];
      locales = new Set<SupportedLocale>();
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

function asLocalizedText(
  value: string | LocalizedText | undefined,
  sourceLocale: SupportedLocale = 'en',
): LocalizedText {
  if (!value) return {};
  if (typeof value === 'string') return { [sourceLocale]: value };
  return Object.fromEntries(
    SUPPORTED_LOCALES.flatMap((locale) =>
      typeof value[locale] === 'string' && value[locale]!.trim()
        ? [[locale, value[locale]!.trim()]]
        : [],
    ),
  ) as LocalizedText;
}

function asLocalizedList(
  value: string[] | LocalizedList | string | LocalizedText | undefined,
  sourceLocale: SupportedLocale = 'en',
): LocalizedList {
  if (!value) return {};
  if (typeof value === 'string') {
    return { [sourceLocale]: splitSourceList(value) };
  }
  if (Array.isArray(value)) return { [sourceLocale]: cleanList(value) };
  const result: LocalizedList = {};
  for (const locale of SUPPORTED_LOCALES) {
    const localized = value[locale];
    if (Array.isArray(localized)) result[locale] = cleanList(localized);
    else if (typeof localized === 'string') {
      result[locale] = splitSourceList(localized);
    }
  }
  return result;
}

function splitSourceList(value: string): string[] {
  const delimiter = value.includes('|') ? /\s*\|\s*/ : /\r?\n+/;
  return cleanList(value.split(delimiter));
}

function cleanList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

function mergeText(base: LocalizedText, overlay: LocalizedText): LocalizedText {
  return { ...base, ...overlay };
}

function mergeList(base: LocalizedList, overlay: LocalizedList): LocalizedList {
  return { ...base, ...overlay };
}

function groupText(
  group: AhmedTour[] | undefined,
  selector: (record: AhmedTour) => string,
): LocalizedText {
  if (!group) return {};
  return Object.fromEntries(
    group.flatMap((record) => {
      const value = selector(record)?.trim();
      return value ? [[record.language, value]] : [];
    }),
  ) as LocalizedText;
}

function groupList(
  group: AhmedTour[] | undefined,
  selector: (record: AhmedTour) => string[],
): LocalizedList {
  if (!group) return {};
  return Object.fromEntries(
    group.flatMap((record) => {
      const value = cleanList(selector(record) ?? []);
      return value.length > 0 ? [[record.language, value]] : [];
    }),
  ) as LocalizedList;
}

function groupItinerary(
  group: AhmedTour[] | undefined,
): NormalizedItineraryDay[] {
  if (!group) return [];
  const maxDays = Math.max(0, ...group.map((record) => record.itinerary.length));
  return Array.from({ length: maxDays }, (_, index) => {
    const descriptionJsonb: LocalizedText = {};
    for (const record of group) {
      const day = record.itinerary[index];
      if (!day) continue;
      const title = day.title?.trim();
      const description = day.description?.trim();
      descriptionJsonb[record.language] =
        title && description && !description.startsWith(title)
          ? `${title}\n${description}`
          : description || title || '';
    }
    return {
      dayLabel: `Day ${index + 1}`,
      descriptionJsonb,
      sortOrder: index,
    };
  }).filter((day) => Object.keys(day.descriptionJsonb).length > 0);
}

function sourceItinerary(days: SourceItineraryDay[] | undefined): NormalizedItineraryDay[] {
  return (days ?? []).map((day, index) => ({
    dayLabel: `Day ${day.day ?? index + 1}`.slice(0, 50),
    descriptionJsonb: mergeText(
      asLocalizedText(day.title),
      asLocalizedText(day.description),
    ),
    mealsJsonb: asLocalizedText(day.meals),
    activitiesJsonb: asLocalizedList(day.activities),
    hotelsJsonb: asLocalizedList(day.hotels),
    transportationJsonb: asLocalizedList(day.transportation),
    notesJsonb: asLocalizedText(day.notes),
    sortOrder: index,
  }));
}

interface TunisiaTranslation {
  title?: string;
  subtitle?: string;
  overview?: string;
  highlights?: string[];
  itinerary?: Array<{ day?: number; title?: string; description?: string; meals?: string }>;
  hotels?: { list?: string[] };
  inclusions?: { items?: string[] };
  exclusions?: { items?: string[] };
  excursions?: { items?: string[] };
}

interface TunisiaSource {
  tourId?: string;
  baseRoute?: string;
  image?: string;
  pricing?: unknown;
  optionalExcursionsPricing?: unknown;
  translations?: Partial<Record<SupportedLocale, TunisiaTranslation>>;
}

function structuredData(
  values: Record<string, unknown>,
): Record<string, unknown> | null {
  const populated = Object.entries(values).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  });
  return populated.length > 0 ? Object.fromEntries(populated) : null;
}

function sourcePresentation(tour: SourceTour, sourceLocale: SupportedLocale) {
  return {
    sourceCodeJsonb: asLocalizedText(tour.code, sourceLocale),
    subtitleJsonb: asLocalizedText(tour.subtitle, sourceLocale),
    highlightsJsonb: asLocalizedList(tour.highlights, sourceLocale),
    departureInfoJsonb: asLocalizedText(tour.departures, sourceLocale),
    market: typeof tour.market === 'string' && tour.market.trim() ? tour.market.trim() : null,
    sourceRating:
      typeof tour.rating === 'number' && Number.isFinite(tour.rating) ? tour.rating : null,
    sourceReviewCount:
      typeof tour.reviewCount === 'number' && Number.isInteger(tour.reviewCount)
        ? tour.reviewCount
        : null,
    hotelInfoJsonb: structuredData({
      accommodation: tour.accommodation,
      hotels: tour.hotels,
      hotelCategory: tour.hotelCategory,
      selectedHotels: tour.selectedHotels,
    }),
    seasonPricingJsonb: structuredData({
      pricing: tour.pricing,
      pricingTiers: tour.pricingTiers,
      optionalExcursionsPricing: tour.optionalExcursionsPricing,
      extraNightPrices: tour.extraNightPrices,
      exhibitionSurcharges: tour.exhibitionSurcharges,
    }),
    transportationJsonb: structuredData({
      route: tour.route,
      transportOptions: asLocalizedText(tour.transportOptions, sourceLocale),
    }),
    termsJsonb: structuredData({ excursions: tour.excursions }),
  };
}

function localesFrom(...values: Array<LocalizedText | LocalizedList>): SupportedLocale[] {
  return SUPPORTED_LOCALES.filter((locale) =>
    values.some((value) => {
      const localized = value[locale];
      return Array.isArray(localized) ? localized.length > 0 : Boolean(localized);
    }),
  );
}

function inferRawCountry(program: SourceTour): string {
  const id = String(program.id ?? '').toUpperCase();
  if (id === 'MRC-01') return 'Morocco';
  if (id === 'REG-29') return 'Egypt';
  if (id.startsWith('HM')) return 'United Arab Emirates';
  const number = Number(id.match(/^REG-(\d+)/)?.[1]);
  if (number >= 15 && number <= 21) return 'Jordan';
  if (number >= 22 && number <= 28) return 'United Arab Emirates';
  if (id.startsWith('IST-') || (number >= 1 && number <= 14)) return 'Turkey';
  return 'Multi-Country';
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150);
}

export function deriveBasePrice(program: SourceTour): number | null {
  if (Number.isFinite(program.price) && Number(program.price) > 0) {
    return Number(program.price);
  }
  const doubleRates: number[] = [];
  const visit = (value: unknown, key = ''): void => {
    if (typeof value === 'number' && value > 0 && /^(dbl|double)$/i.test(key)) {
      doubleRates.push(value);
      return;
    }
    if (Array.isArray(value)) value.forEach((entry) => visit(entry, key));
    else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([childKey, child]) => visit(child, childKey));
    }
  };
  visit(program.pricing);
  return doubleRates.length > 0 ? Math.min(...doubleRates) : null;
}

function normalizeImages(tour: SourceTour): NormalizedTourImage[] {
  return (tour.images ?? []).filter(Boolean).map((imageUrl, index) => ({
    imageUrl,
    isHero: index === 0,
    altText: null,
    sortOrder: index,
  }));
}

function normalizeCuratedTour(
  tour: SourceTour,
  destination: string,
  group: AhmedTour[] | undefined,
): NormalizedTour {
  const sourceLocale = SUPPORTED_LOCALES.includes(tour.language as SupportedLocale)
    ? (tour.language as SupportedLocale)
    : tour.language === 'pt-BR'
      ? 'pt'
      : 'en';
  const titleJsonb = mergeText(
    asLocalizedText(tour.title ?? tour.name, sourceLocale),
    groupText(group, (record) => record.title),
  );
  const durationJsonb = mergeText(
    asLocalizedText(tour.duration, sourceLocale),
    groupText(group, (record) => record.duration),
  );
  const overviewJsonb = mergeText(
    asLocalizedText(tour.overview ?? tour.description, sourceLocale),
    groupText(group, (record) => record.overview),
  );
  const includedServicesJsonb = mergeList(
    asLocalizedList(tour.included ?? tour.includes, sourceLocale),
    groupList(group, (record) => record.included),
  );
  const excludedServicesJsonb = mergeList(
    asLocalizedList(tour.excluded ?? tour.excludes, sourceLocale),
    groupList(group, (record) => record.excluded),
  );
  const groupedItinerary = groupItinerary(group);
  const basePriceUsd = deriveBasePrice(tour);
  const country = destination === 'multiCountry' ? 'Multi-Country' : destination;
  const presentation = sourcePresentation(tour, sourceLocale);
  presentation.highlightsJsonb = mergeList(
    presentation.highlightsJsonb,
    groupList(group, (record) => record.highlights),
  );
  return {
    sourceId: String(tour.id ?? tour.slug),
    ...presentation,
    slug: String(tour.slug),
    titleJsonb,
    durationJsonb,
    overviewJsonb,
    minPaxJsonb: groupText(group, (record) => record.groupSize),
    includedServicesJsonb,
    excludedServicesJsonb,
    category: tour.type ?? tour.market ?? destination,
    country: country.replace(/^./, (value) => value.toUpperCase()),
    basePriceUsd,
    currency: 'USD',
    status: basePriceUsd ? 'PUBLISHED' : 'DRAFT',
    isActive: Boolean(basePriceUsd),
    languages: localesFrom(titleJsonb, overviewJsonb),
    tags: ['ahmed-source', destination.toLowerCase(), String(tour.id ?? '').toLowerCase()].filter(Boolean),
    itineraries:
      groupedItinerary.length > 0
        ? groupedItinerary
        : sourceItinerary(tour.itinerary ?? tour.days),
    images: normalizeImages(tour),
  };
}

function normalizeRawProgram(program: SourceTour): NormalizedTour {
  const titleJsonb = asLocalizedText(program.name ?? program.title);
  const durationJsonb = asLocalizedText(program.duration);
  const overviewJsonb = asLocalizedText(program.overview ?? program.description);
  const minPaxJsonb = asLocalizedText(program.minPax);
  const includedServicesJsonb = asLocalizedList(program.includes ?? program.included);
  const excludedServicesJsonb = asLocalizedList(program.excludes ?? program.excluded);
  const sourceId = String(program.id ?? program.slug ?? titleJsonb.en ?? 'program');
  const slug = program.slug ?? slugify(`${sourceId}-${titleJsonb.en ?? sourceId}`);
  const basePriceUsd = deriveBasePrice(program);
  const country = inferRawCountry(program);
  return {
    sourceId,
    ...sourcePresentation(program, 'en'),
    slug,
    titleJsonb,
    durationJsonb,
    overviewJsonb,
    minPaxJsonb,
    includedServicesJsonb,
    excludedServicesJsonb,
    category: program.type ?? (sourceId.startsWith('HM') ? 'Honeymoon' : country),
    country,
    basePriceUsd,
    currency: 'USD',
    status: basePriceUsd ? 'PUBLISHED' : 'DRAFT',
    isActive: Boolean(basePriceUsd),
    languages: localesFrom(titleJsonb, overviewJsonb),
    tags: ['ahmed-source', 'raw-program', sourceId.toLowerCase(), country.toLowerCase()],
    itineraries: sourceItinerary(program.days ?? program.itinerary),
    images: normalizeImages(program),
  };
}

function normalizeAhmedOnly(
  config: (typeof AHMED_ONLY_GROUPS)[number],
  group: AhmedTour[],
): NormalizedTour {
  const titleJsonb = groupText(group, (record) => record.title);
  const durationJsonb = groupText(group, (record) => record.duration);
  const overviewJsonb = groupText(group, (record) => record.overview);
  const includedServicesJsonb = groupList(group, (record) => record.included);
  const excludedServicesJsonb = groupList(group, (record) => record.excluded);
  return {
    sourceId: `ahmed-group-${config.index + 1}`,
    sourceCodeJsonb: {},
    subtitleJsonb: {},
    highlightsJsonb: groupList(group, (record) => record.highlights),
    departureInfoJsonb: {},
    market: null,
    sourceRating: null,
    sourceReviewCount: null,
    slug: config.slug,
    titleJsonb,
    durationJsonb,
    overviewJsonb,
    minPaxJsonb: groupText(group, (record) => record.groupSize),
    includedServicesJsonb,
    excludedServicesJsonb,
    category: config.category,
    country: config.country,
    basePriceUsd: null,
    currency: 'USD',
    status: 'DRAFT',
    isActive: false,
    languages: localesFrom(titleJsonb, overviewJsonb),
    tags: ['ahmed-source', 'ahmed-only', config.category.toLowerCase()],
    hotelInfoJsonb: null,
    seasonPricingJsonb: null,
    transportationJsonb: null,
    termsJsonb: null,
    itineraries: groupItinerary(group),
    images: [],
  };
}

export function validateCatalog(catalog: NormalizedTour[]): void {
  const slugs = new Set<string>();
  for (const tour of catalog) {
    if (!tour.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tour.slug)) {
      throw new Error(`Invalid normalized slug: ${tour.slug}`);
    }
    if (slugs.has(tour.slug)) throw new Error(`Duplicate normalized slug: ${tour.slug}`);
    slugs.add(tour.slug);
    if (!Object.values(tour.titleJsonb).some((title) => Boolean(title?.trim()))) {
      throw new Error(`Missing localized title: ${tour.slug}`);
    }
    if (tour.basePriceUsd !== null && tour.basePriceUsd <= 0) {
      throw new Error(`Invalid price: ${tour.slug}`);
    }
    if (!destinationSlugForCountry(tour.country)) {
      throw new Error(`Missing destination mapping: ${tour.slug} (${tour.country})`);
    }
  }
}

/** Resolve the structured Tunisia source rather than persisting its UI lookup keys. */
function enrichTunisiaTour(tour: SourceTour, source: TunisiaSource | undefined): SourceTour {
  if (!source || source.tourId !== tour.id || !source.translations) return tour;
  const translations = Object.entries(source.translations).filter(
    ([locale]) => SUPPORTED_LOCALES.includes(locale as SupportedLocale),
  ) as Array<[SupportedLocale, TunisiaTranslation]>;
  const text = (selector: (entry: TunisiaTranslation) => string | undefined): LocalizedText =>
    Object.fromEntries(translations.flatMap(([locale, entry]) => {
      const value = selector(entry)?.trim();
      return value ? [[locale, value]] : [];
    })) as LocalizedText;
  const list = (selector: (entry: TunisiaTranslation) => string[] | undefined): LocalizedList =>
    Object.fromEntries(translations.flatMap(([locale, entry]) => {
      const value = cleanList(selector(entry) ?? []);
      return value.length > 0 ? [[locale, value]] : [];
    })) as LocalizedList;
  const maxDays = Math.max(
    0,
    ...translations.map(([, entry]) => entry.itinerary?.length ?? 0),
  );
  const itinerary = Array.from({ length: maxDays }, (_, index) => ({
    day: index + 1,
    title: text((entry) => entry.itinerary?.[index]?.title),
    description: text((entry) => entry.itinerary?.[index]?.description),
    meals: text((entry) => entry.itinerary?.[index]?.meals),
  }));
  const sourcePricing = source.pricing as { categories?: unknown } | undefined;
  return {
    ...tour,
    title: text((entry) => entry.title),
    subtitle: text((entry) => entry.subtitle),
    overview: text((entry) => entry.overview),
    highlights: list((entry) => entry.highlights),
    included: list((entry) => entry.inclusions?.items),
    excluded: list((entry) => entry.exclusions?.items),
    hotels: list((entry) => entry.hotels?.list),
    excursions: list((entry) => entry.excursions?.items),
    itinerary,
    images: source.image ? [source.image] : tour.images,
    route: source.baseRoute ?? tour.route,
    pricing: source.pricing ?? tour.pricing,
    pricingTiers: sourcePricing?.categories ?? tour.pricingTiers,
    optionalExcursionsPricing:
      source.optionalExcursionsPricing ?? tour.optionalExcursionsPricing,
  };
}

export function loadAhmedCatalog(sourceDirectory: string): NormalizedTour[] {
  if (!fs.existsSync(sourceDirectory)) {
    throw new Error(`Ahmed source directory does not exist: ${sourceDirectory}`);
  }
  const files = walkFiles(sourceDirectory);
  const combinedPath = findLargestFile(
    files,
    (filePath) => path.extname(filePath) === '.json' && path.dirname(filePath) === sourceDirectory,
  );
  const programsPath = findLargestFile(
    files,
    (filePath) => path.basename(filePath) === 'programs.json',
  );
  const ahmedPath = path.join(sourceDirectory, 'ahmedData.tsx');
  const tunisiaPath = files.find(
    (filePath) => path.basename(filePath) === 'tunisia-tour-data.json',
  );
  const combined = readJson<CombinedSource>(combinedPath);
  const tunisia = tunisiaPath ? readJson<TunisiaSource>(tunisiaPath) : undefined;
  const rawPrograms = readJson<{ programs: SourceTour[] }>(programsPath).programs;
  const groups = groupAhmedTranslations(parseAhmedData(ahmedPath));
  if (groups.length !== 19) {
    throw new Error(`Expected 19 Ahmed translation groups, received ${groups.length}`);
  }

  const curated = Object.entries(combined.destinations).flatMap(
    ([destination, bucket]) =>
      (bucket.tours ?? []).map((tour) =>
        normalizeCuratedTour(
          enrichTunisiaTour(tour, tunisia),
          destination,
          groups[CURATED_AHMED_GROUP_BY_SLUG[String(tour.slug)]],
        ),
      ),
  );
  const ahmedOnly = AHMED_ONLY_GROUPS.map((config) =>
    normalizeAhmedOnly(config, groups[config.index]),
  );
  const raw = rawPrograms.map(normalizeRawProgram);
  const catalog = [...curated, ...ahmedOnly, ...raw];
  validateCatalog(catalog);
  return catalog;
}
