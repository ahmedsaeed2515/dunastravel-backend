import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

type SupportedLocale = 'ar' | 'en' | 'es' | 'pt' | 'it';
type LocalizedText = Record<SupportedLocale, string>;
type LocalizedList = Record<SupportedLocale, string[]>;
type UnknownRecord = Record<string, any>;

const LOCALES: SupportedLocale[] = ['ar', 'en', 'es', 'pt', 'it'];

const nativeImport = new Function('specifier', 'return import(specifier);') as (
  specifier: string,
) => Promise<any>;

const staticTourTitles: Record<string, Record<SupportedLocale, string>> = {
  'mct001.title': {
    en: 'Egypt & Turkey Grand Discovery 15 Days',
    es: 'Gran Descubrimiento de Egipto y Turquía 15 Días',
    ar: 'اكتشاف مصر وتركيا الكبرى 15 يوماً',
    pt: 'Grande Descoberta do Egito e Turquia 15 Dias',
    it: 'Grande Scoperta d\'Egitto e Turchia 15 Giorni',
  },
  'mct002.title': {
    en: 'Egypt, Jordan & Jerusalem Sacred Odyssey 14 Days',
    es: 'Odisea Sagrada de Egipto, Jordania y Jerusalén 14 Días',
    ar: 'رحلة مصر والأردن والقدس المقدسة 14 يوماً',
    pt: 'Odisseia Sagrada de Egito, Jordânia e Jerusalém 14 Dias',
    it: 'Odissea Sacra d\'Egitto, Giordania e Gerusalemme 14 Giorni',
  },
  'mct003.title': {
    en: 'Egypt & Dubai Luxury Highlights 12 Days',
    es: 'Lo Mejor del Lujo en Egipto y Dubái 12 Días',
    ar: 'أبرز معالم الفخامة في مصر ودبي 12 يوماً',
    pt: 'Destaques de Luxo do Egito e Dubai 12 Dias',
    it: 'Il Meglio del Lusso d\'Egitto e Dubai 12 Giorni',
  },
  'mct004.title': {
    en: 'Egypt & Morocco Imperial Horizons 16 Days',
    es: 'Horizontes Imperiales de Egipto y Marruecos 16 Días',
    ar: 'آفاق مصر والمغرب الإمبراطورية 16 يوماً',
    pt: 'Horizontes Imperiais do Egito e Marrocos 16 Dias',
    it: 'Orizzonti Imperiali d\'Egitto e Marocco 16 Giorni',
  },
  'mct005.title': {
    en: 'Stars of the Middle East 16 Days',
    es: 'Estrellas del Medio Oriente 16 Días',
    ar: 'نجوم الشرق الأوسط 16 يوماً',
    pt: 'Estrelas do Oriente Médio 16 Dias',
    it: 'Stelle del Medio Oriente 16 Giorni',
  },
  'mct006.title': {
    en: 'Treasures of Egypt & Tunisia 16 Days',
    es: 'Tesoros de Egipto y Túnez 16 Días',
    ar: 'كنوز مصر وتونس 16 يوماً',
    pt: 'Tesouros do Egito e Tunísia 16 Dias',
    it: 'Tesori d\'Egitto e Tunisia 16 Giorni',
  },
  'mct007.title': {
    en: 'Egypt & Dubai Oasis Journey 13 Days',
    es: 'Egipto y Dubái Viaje de Oasis 13 Días',
    ar: 'رحلة واحة مصر ودبي 13 يوماً',
    pt: 'Egito e Dubai Viagem Oásis 13 Dias',
    it: 'Egitto e Dubai Viaggio Oasi 13 Giorni',
  },
  'mct008.title': {
    en: 'Spices of Egypt & Morocco 14 Days',
    es: 'Especias de Egipto y Marruecos 14 Días',
    ar: 'توابل مصر والمغرب 14 يوماً',
    pt: 'Especiarias do Egito e Marrocos 14 Dias',
    it: 'Spezie d\'Egitto e Marocco 14 Giorni',
  },
  'mct009.title': {
    en: 'Jewels of Egypt & Jordan 11 Days',
    es: 'Joyas de Egipto y Jordania 11 Días',
    ar: 'جواهر مصر والأردن 11 يوماً',
    pt: 'Jóias do Egito e Jordânia 11 Dias',
    it: 'Gioielli d\'Egitto e Giordania 11 Giorni',
  },
  'tunisia_tour_title': {
    ar: 'برنامج تونس الخضراء المتميز',
    es: 'Circuito Túnez Verde Premium - 8 Días / 7 Noches',
    en: 'Premium Green Tunisia Tour - 8 Days / 7 Nights',
    it: 'Tour Tunisia Verde Premium - 8 Giorni / 7 Notti',
    pt: 'Circuito Tunísia Verde Premium - 8 Dias / 7 Noites',
  },
  'Circuito Túnez - 8 Días / 7 Noches': {
    ar: 'برنامج تونس الخضراء المتميز',
    es: 'Circuito Túnez Verde Premium - 8 Días / 7 Noches',
    en: 'Premium Green Tunisia Tour - 8 Days / 7 Nights',
    it: 'Tour Tunisia Verde Premium - 8 Giorni / 7 Notti',
    pt: 'Circuito Tunísia Verde Premium - 8 Dias / 7 Noites',
  },
  'completoEgypt.title': {
    en: 'Complete Egypt Grand Tour 8 Days',
    es: 'Gran Tour Completo de Egipto 8 Días',
    ar: 'جولة مصر الكبرى الشاملة 8 أيام',
    pt: 'Grande Tour Completo pelo Egito 8 Dias',
    it: 'Gran Tour Completo dell\'Egitto 8 Giorni',
  },
};

const programImages: Record<string, string[]> = {
  'REG-22': ['https://wallpaperaccess.com/full/222675.jpg', 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80'],
  'REG-23': ['https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=1200&q=80'],
  'REG-24': ['https://dynamic-media-cdn.tripadvisor.com/media/photo-o/29/cf/55/ba/caption.jpg?w=1200&h=1200&s=1', 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80'],
  'REG-25': ['https://www.yasmina.com/tachyon/sites/5/2022/01/7f96899cbdde462971ae6a503d3a61cfc65f50a1.jpg', 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80'],
  'REG-26': ['https://i.pinimg.com/736x/7b/a8/4e/7ba84eb916025464c345151b07fc4604.jpg', 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80'],
  'REG-27': ['https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1513581166391-887a96ddeafd?auto=format&fit=crop&w=1200&q=80'],
  'REG-28': ['https://images.unsplash.com/photo-1513581166391-887a96ddeafd?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80'],
  'HM001': ['https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80'],
  'HM002': ['https://media-cdn.tripadvisor.com/media/attractions-splice-spp-720x480/07/19/7f/2e.jpg', 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80'],
};

function readDictionaries(sourceDirectory: string): Record<SupportedLocale, UnknownRecord> {
  const localeDirectory = path.resolve(sourceDirectory, '..', 'i18n', 'locales');
  return Object.fromEntries(LOCALES.map((locale) => {
    const filePath = path.join(localeDirectory, `${locale}.json`);
    return [locale, JSON.parse(fs.readFileSync(filePath, 'utf8'))];
  })) as Record<SupportedLocale, UnknownRecord>;
}

function resolveKey(key: string, locale: SupportedLocale, dicts: Record<SupportedLocale, UnknownRecord>): string {
  if (!key || typeof key !== 'string') return '';
  const d = dicts[locale];
  if (!d) return key;

  if (typeof d[key] === 'string' && d[key].trim()) return d[key];
  if (typeof d.data?.[key] === 'string' && d.data[key].trim()) return d.data[key];

  const withData = `data.${key}`;
  if (typeof d[withData] === 'string' && d[withData].trim()) return d[withData];

  const stripped = key.replace(/^data\./, '');
  if (typeof d[stripped] === 'string' && d[stripped].trim()) return d[stripped];

  if (staticTourTitles[key]?.[locale]) return staticTourTitles[key][locale];
  if (staticTourTitles[stripped]?.[locale]) return staticTourTitles[stripped][locale];

  return key;
}

function normalizeLocalizedText(value: any, dicts: Record<SupportedLocale, UnknownRecord>): LocalizedText {
  if (!value) {
    return { ar: '', en: '', es: '', pt: '', it: '' };
  }
  if (typeof value === 'string') {
    return {
      ar: resolveKey(value, 'ar', dicts),
      en: resolveKey(value, 'en', dicts),
      es: resolveKey(value, 'es', dicts),
      pt: resolveKey(value, 'pt', dicts),
      it: resolveKey(value, 'it', dicts),
    };
  }
  if (typeof value === 'object') {
    return {
      ar: typeof value.ar === 'string' ? resolveKey(value.ar, 'ar', dicts) : resolveKey(value.en, 'ar', dicts),
      en: typeof value.en === 'string' ? resolveKey(value.en, 'en', dicts) : '',
      es: typeof value.es === 'string' ? resolveKey(value.es, 'es', dicts) : resolveKey(value.en, 'es', dicts),
      pt: typeof value.pt === 'string' ? resolveKey(value.pt, 'pt', dicts) : resolveKey(value.en, 'pt', dicts),
      it: typeof value.it === 'string' ? resolveKey(value.it, 'it', dicts) : resolveKey(value.en, 'it', dicts),
    };
  }
  return { ar: '', en: '', es: '', pt: '', it: '' };
}

function normalizeLocalizedList(value: any, dicts: Record<SupportedLocale, UnknownRecord>): LocalizedList {
  if (!value) {
    return { ar: [], en: [], es: [], pt: [], it: [] };
  }
  if (Array.isArray(value)) {
    return {
      ar: value.map((item) => resolveKey(item, 'ar', dicts)).filter(Boolean),
      en: value.map((item) => resolveKey(item, 'en', dicts)).filter(Boolean),
      es: value.map((item) => resolveKey(item, 'es', dicts)).filter(Boolean),
      pt: value.map((item) => resolveKey(item, 'pt', dicts)).filter(Boolean),
      it: value.map((item) => resolveKey(item, 'it', dicts)).filter(Boolean),
    };
  }
  if (typeof value === 'object') {
    return {
      ar: Array.isArray(value.ar) ? value.ar.map((item: string) => resolveKey(item, 'ar', dicts)) : (Array.isArray(value.en) ? value.en.map((item: string) => resolveKey(item, 'ar', dicts)) : []),
      en: Array.isArray(value.en) ? value.en.map((item: string) => resolveKey(item, 'en', dicts)) : [],
      es: Array.isArray(value.es) ? value.es.map((item: string) => resolveKey(item, 'es', dicts)) : (Array.isArray(value.en) ? value.en.map((item: string) => resolveKey(item, 'es', dicts)) : []),
      pt: Array.isArray(value.pt) ? value.pt.map((item: string) => resolveKey(item, 'pt', dicts)) : (Array.isArray(value.en) ? value.en.map((item: string) => resolveKey(item, 'pt', dicts)) : []),
      it: Array.isArray(value.it) ? value.it.map((item: string) => resolveKey(item, 'it', dicts)) : (Array.isArray(value.en) ? value.en.map((item: string) => resolveKey(item, 'it', dicts)) : []),
    };
  }
  return { ar: [], en: [], es: [], pt: [], it: [] };
}

export interface MasterTour {
  slug: string;
  sourceCatalogId: string;
  country: string;
  category: string;
  destinationSlug: string;
  additionalLandingPages?: string[];
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
  market?: string;
  sourceRating?: number;
  sourceReviewCount?: number;
  images: Array<{ imageUrl: string; altText: string | null; sortOrder: number }>;
  itinerary: Array<{
    dayLabel: string | null;
    descriptionJsonb: LocalizedText;
    mealsJsonb: LocalizedText | null;
    sortOrder: number;
  }>;
}

export async function buildMasterCatalog(sourceDir: string): Promise<MasterTour[]> {
  const dicts = readDictionaries(sourceDir);

  // 1. Base tours
  const toursModule = await nativeImport(pathToFileURL(path.join(sourceDir, 'tours.js')).href);
  const baseToursList: any[] = toursModule.tours || toursModule.default || [];

  // 2. Turkey, Jordan, Dubai, Multi-Country
  const [turkeyMod, jordanMod, dubaiMod, multiMod] = await Promise.all([
    nativeImport(pathToFileURL(path.join(sourceDir, 'turkeyTours.js')).href),
    nativeImport(pathToFileURL(path.join(sourceDir, 'jordanTours.js')).href),
    nativeImport(pathToFileURL(path.join(sourceDir, 'dubaiTours.js')).href),
    nativeImport(pathToFileURL(path.join(sourceDir, 'multiCountryTours.js')).href),
  ]);

  const turkeyList: any[] = turkeyMod.turkeyTours || [];
  const jordanList: any[] = jordanMod.jordanTours || jordanMod.default || [];
  const dubaiList: any[] = dubaiMod.dubaiTours || [];
  const multiList: any[] = multiMod.multiCountryTours || multiMod.default || [];

  const masterList: MasterTour[] = [];
  const cleanSlug = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  // 1. Ingest Base Tours (12 tours: 9 Egypt + 1 Tunisia + 1 Morocco + 1 Greece)
  for (const tour of baseToursList) {
    const slug = cleanSlug(tour.slug || tour.id);
    let country = 'Egypt';
    let dest = 'egypt';
    const dLower = (tour.destination || '').toLowerCase();
    if (dLower === 'tunisia') { country = 'Tunisia'; dest = 'tunisia'; }
    else if (dLower === 'morocco') { country = 'Morocco'; dest = 'morocco'; }
    else if (dLower === 'greece') { country = 'Greece'; dest = 'greece'; }

    const rawTitle = tour.title ?? tour.name;
    const cat = tour.type || tour.category || 'Classic';
    const images: string[] = Array.isArray(tour.images) ? tour.images : (tour.heroImage ? [tour.heroImage] : []);
    const itinDays: any[] = Array.isArray(tour.itinerary) ? tour.itinerary : (Array.isArray(tour.days) ? tour.days : []);

    masterList.push({
      slug,
      sourceCatalogId: tour.id,
      country,
      category: cat === 'completoEgypt.type' ? 'Complete Egypt Tour' : cat,
      destinationSlug: dest,
      titleJsonb: normalizeLocalizedText(rawTitle, dicts),
      subtitleJsonb: normalizeLocalizedText(tour.subtitle, dicts),
      durationJsonb: normalizeLocalizedText(tour.duration, dicts),
      overviewJsonb: normalizeLocalizedText(tour.overview ?? tour.description, dicts),
      highlightsJsonb: normalizeLocalizedList(tour.highlights, dicts),
      includedServicesJsonb: normalizeLocalizedList(tour.included ?? tour.includes, dicts),
      excludedServicesJsonb: normalizeLocalizedList(tour.excluded ?? tour.excludes, dicts),
      minPaxJsonb: normalizeLocalizedText(tour.minPax || '2 Pax', dicts),
      departureInfoJsonb: normalizeLocalizedText(tour.departures || 'Daily', dicts),
      hotelInfoJsonb: tour.hotels || tour.selectedHotels ? { hotels: tour.hotels, selectedHotels: tour.selectedHotels, category: tour.hotelCategory } : null,
      sourceCodeJsonb: tour,
      market: tour.market,
      sourceRating: tour.rating,
      sourceReviewCount: tour.reviewCount,
      images: images.map((imageUrl, sortOrder) => ({ imageUrl, altText: null, sortOrder })),
      itinerary: itinDays.map((d, sortOrder) => ({
        dayLabel: typeof d.title === 'string' ? resolveKey(d.title, 'en', dicts) : `Day ${sortOrder + 1}`,
        descriptionJsonb: normalizeLocalizedText(d.description ?? d.body, dicts),
        mealsJsonb: d.meals ? normalizeLocalizedText(d.meals, dicts) : null,
        sortOrder,
      })),
    });
  }

  // 2. Special Egypt Packages
  // A. Classic Egypt Programme (8 Days)
  const classicItin = [1,2,3,4,5,6,7,8].map(day => ({
    dayLabel: resolveKey(`classic.day${day}.title`, 'en', dicts),
    descriptionJsonb: {
      ar: resolveKey(`classic.day${day}.body`, 'ar', dicts),
      en: resolveKey(`classic.day${day}.body`, 'en', dicts),
      es: resolveKey(`classic.day${day}.body`, 'es', dicts),
      pt: resolveKey(`classic.day${day}.body`, 'pt', dicts),
      it: resolveKey(`classic.day${day}.body`, 'it', dicts),
    },
    mealsJsonb: null,
    sortOrder: day - 1,
  }));
  masterList.push({
    slug: 'classic-program',
    sourceCatalogId: 'prog-cls-3',
    country: 'Egypt',
    category: 'Classic',
    destinationSlug: 'egypt',
    titleJsonb: normalizeLocalizedText('classic.title', dicts),
    subtitleJsonb: normalizeLocalizedText('classic.shortDesc', dicts),
    durationJsonb: { ar: '8 أيام', en: '8 Days', es: '8 Días', pt: '8 Dias', it: '8 Giorni' },
    overviewJsonb: normalizeLocalizedText('classic.overview', dicts),
    highlightsJsonb: normalizeLocalizedList(['classic.highlight.1', 'classic.highlight.2', 'classic.highlight.3', 'classic.highlight.4', 'classic.highlight.5'], dicts),
    includedServicesJsonb: normalizeLocalizedList(['classic.included.1', 'classic.included.2', 'classic.included.3', 'classic.included.4', 'classic.included.5'], dicts),
    excludedServicesJsonb: normalizeLocalizedList(['classic.excluded.1', 'classic.excluded.2', 'classic.excluded.3', 'classic.excluded.4'], dicts),
    minPaxJsonb: { ar: 'شخصين', en: '2-16 Pax', es: '2-16 Pax', pt: '2-16 Pax', it: '2-16 Pax' },
    departureInfoJsonb: { ar: 'يومي', en: 'Daily', es: 'Diario', pt: 'Diário', it: 'Giornaliero' },
    hotelInfoJsonb: { hotelCategory: '5 Star Deluxe' },
    sourceCodeJsonb: { source: 'ClassicProgramDetails.jsx' },
    market: 'Global',
    sourceRating: 4.9,
    sourceReviewCount: 402,
    images: [
      { imageUrl: 'https://res.cloudinary.com/degbrq3ck/image/upload/v1783029636/Classic_Program_gfal0s.jpg', altText: 'Classic Program', sortOrder: 0 },
      { imageUrl: 'https://images.unsplash.com/photo-1568322445389-f64ac2515020?auto=format&fit=crop&w=1200&q=80', altText: 'Cairo Pyramids', sortOrder: 1 },
      { imageUrl: 'https://images.unsplash.com/photo-1539650116574-8efeb43e2750?auto=format&fit=crop&w=1200&q=80', altText: 'Nile Cruise', sortOrder: 2 },
      { imageUrl: 'https://images.unsplash.com/photo-1572252821143-035a024856f2?auto=format&fit=crop&w=1200&q=80', altText: 'Luxor Temple', sortOrder: 3 },
    ],
    itinerary: classicItin,
  });

  // B. Honeymoon in Egypt (10 Days)
  const honeymoonItin = [1,2,3,4,5,6,7,8,9,10].map(day => ({
    dayLabel: resolveKey(`honeymooners.day${day}Title`, 'en', dicts),
    descriptionJsonb: {
      ar: resolveKey(`honeymooners.day${day}Desc`, 'ar', dicts),
      en: resolveKey(`honeymooners.day${day}Desc`, 'en', dicts),
      es: resolveKey(`honeymooners.day${day}Desc`, 'es', dicts),
      pt: resolveKey(`honeymooners.day${day}Desc`, 'pt', dicts),
      it: resolveKey(`honeymooners.day${day}Desc`, 'it', dicts),
    },
    mealsJsonb: null,
    sortOrder: day - 1,
  }));
  masterList.push({
    slug: 'honeymoon-in-egypt',
    sourceCatalogId: 'prog-hon-1',
    country: 'Egypt',
    category: 'Honeymoon',
    destinationSlug: 'egypt',
    titleJsonb: normalizeLocalizedText('honeymooners.egyptTitle', dicts),
    subtitleJsonb: normalizeLocalizedText('honeymooners.egyptTagline', dicts),
    durationJsonb: { ar: '10 أيام / 9 ليالٍ', en: '10 Days / 9 Nights', es: '10 Días / 9 Noches', pt: '10 Dias / 9 Noites', it: '10 Giorni / 9 Notti' },
    overviewJsonb: normalizeLocalizedText('honeymooners.heroDesc', dicts),
    highlightsJsonb: normalizeLocalizedList(['honeymooners.tag1', 'honeymooners.tag2', 'honeymooners.tag3'], dicts),
    includedServicesJsonb: normalizeLocalizedList(['honeymooners.inc1', 'honeymooners.inc2', 'honeymooners.inc3', 'honeymooners.inc4', 'honeymooners.inc5', 'honeymooners.inc6', 'honeymooners.inc7', 'honeymooners.inc8'], dicts),
    excludedServicesJsonb: { ar: ['المصاريف الشخصية'], en: ['Personal expenses'], es: ['Gastos personales'], pt: ['Despesas pessoais'], it: ['Spese personali'] },
    minPaxJsonb: { ar: 'شخصين', en: '2 Pax (Couples)', es: '2 Pax', pt: '2 Pax', it: '2 Pax' },
    departureInfoJsonb: { ar: 'يومي', en: 'Daily', es: 'Diario', pt: 'Diário', it: 'Giornaliero' },
    hotelInfoJsonb: { hotelCategory: '5 Star Luxury Honeymoon Suites' },
    sourceCodeJsonb: { source: 'HoneymoonersDetails.jsx' },
    market: 'Global',
    sourceRating: 5.0,
    sourceReviewCount: 185,
    images: [
      { imageUrl: 'https://hl-tourism.com/media/typecms/Honeymoon_Planning_Guide_2025_Complete_Resource.webp', altText: 'Honeymoon in Egypt', sortOrder: 0 },
      { imageUrl: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=1200&q=80', altText: 'Romantic Nile Dinner', sortOrder: 1 },
      { imageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80', altText: 'Red Sea Resort', sortOrder: 2 },
    ],
    itinerary: honeymoonItin,
  });

  // C. Journey of the Holy Family (10 Days)
  const holyFamilyItin = [1,2,3,4,5,6,7,8,9,10].map(day => ({
    dayLabel: resolveKey(`tour_jordan_day${day}_title`, 'en', dicts),
    descriptionJsonb: {
      ar: resolveKey(`tour_jordan_day${day}_body`, 'ar', dicts),
      en: resolveKey(`tour_jordan_day${day}_body`, 'en', dicts),
      es: resolveKey(`tour_jordan_day${day}_body`, 'es', dicts),
      pt: resolveKey(`tour_jordan_day${day}_body`, 'pt', dicts),
      it: resolveKey(`tour_jordan_day${day}_body`, 'it', dicts),
    },
    mealsJsonb: null,
    sortOrder: day - 1,
  }));
  masterList.push({
    slug: 'journey-of-the-holy-family-10-days',
    sourceCatalogId: 'ahmed-group-10',
    country: 'Egypt',
    category: 'Religious',
    destinationSlug: 'egypt',
    additionalLandingPages: ['religious'],
    titleJsonb: normalizeLocalizedText('tour_jordan_title', dicts),
    subtitleJsonb: normalizeLocalizedText('tour_jordan_shortDesc', dicts),
    durationJsonb: { ar: '10 أيام / 9 ليالٍ', en: '10 Days / 9 Nights', es: '10 Días / 9 Noches', pt: '10 Dias / 9 Noites', it: '10 Giorni / 9 Notti' },
    overviewJsonb: normalizeLocalizedText('programs.religiousLead', dicts),
    highlightsJsonb: normalizeLocalizedList(['tour_jordan_highlight_1', 'tour_jordan_highlight_2', 'tour_jordan_highlight_3', 'tour_jordan_highlight_4'], dicts),
    includedServicesJsonb: normalizeLocalizedList(['programs.religiousTag1', 'programs.religiousTag2', 'programs.religiousTag3'], dicts),
    excludedServicesJsonb: { ar: ['تذاكر الطيران الدولي'], en: ['International flights'], es: ['Vuelos internacionales'], pt: ['Voos internacionais'], it: ['Voli internazionali'] },
    minPaxJsonb: { ar: 'شخصين', en: '2 Pax', es: '2 Pax', pt: '2 Pax', it: '2 Pax' },
    departureInfoJsonb: { ar: 'أسبوعي / عند الطلب', en: 'Weekly / On Request', es: 'Semanal', pt: 'Semanal', it: 'Settimanale' },
    hotelInfoJsonb: { hotelCategory: '5 Star Heritage & Luxury' },
    sourceCodeJsonb: { source: 'ReligiousTours.jsx' },
    market: 'Global',
    sourceRating: 5.0,
    sourceReviewCount: 142,
    images: [
      { imageUrl: 'https://sft-nationaltours.com/wp-content/uploads/2024/11/holy-family-egypt_tg_1397-870x555.jpg', altText: 'Holy Family Egypt', sortOrder: 0 },
      { imageUrl: 'https://images.unsplash.com/photo-1548013146-72479768bada?w=1200&q=80', altText: 'Coptic Monasteries', sortOrder: 1 },
      { imageUrl: 'https://images.unsplash.com/photo-1509822929464-92b5d5e8827b?w=1200&q=80', altText: 'Mount Sinai & Saint Catherine', sortOrder: 2 },
    ],
    itinerary: holyFamilyItin,
  });

  // D. Egypt & Jordan Combined Pilgrimage (14 Days)
  masterList.push({
    slug: 'egypt-jordan-combined-14d',
    sourceCatalogId: 'prog-rel-egypt-jordan',
    country: 'Egypt',
    category: 'Religious',
    destinationSlug: 'egypt',
    additionalLandingPages: ['religious'],
    titleJsonb: { ar: 'رحلة مصر والأردن الدينية والتاريخية الكبرى - 14 يوماً', en: 'Grand Egypt & Jordan Pilgrimage - 14 Days', es: 'Gran Peregrinación Egipto y Jordania - 14 Días', pt: 'Grande Peregrinação Egito e Jordânia - 14 Dias', it: 'Grande Pellegrinaggio Egitto e Giordania - 14 Giorni' },
    subtitleJsonb: { ar: 'من مسار العائلة المقدسة والأهرامات إلى البتراء ووادي رم وجبل نيبو', en: 'From the Holy Family trail & Pyramids to Petra, Wadi Rum & Mount Nebo', es: 'Desde la Sagrada Familia y Pirámides hasta Petra y Monte Nebo', pt: 'Da Sagrada Família e Pirâmides até Petra e Monte Nebo', it: 'Dalla Sacra Famiglia e Piramidi a Petra e Monte Nebo' },
    durationJsonb: { ar: '14 يوماً / 13 ليلة', en: '14 Days / 13 Nights', es: '14 Días / 13 Noches', pt: '14 Dias / 13 Noites', it: '14 Giorni / 13 Notti' },
    overviewJsonb: normalizeLocalizedText('programs.religiousLead', dicts),
    highlightsJsonb: normalizeLocalizedList(['tour_jordan_highlight_1', 'tour_jordan_highlight_2', 'tour_jordan_highlight_3', 'tour_jordan_highlight_4', 'tour_jordan_highlight_5', 'tour_jordan_highlight_6', 'tour_jordan_highlight_7'], dicts),
    includedServicesJsonb: normalizeLocalizedList(['programs.religiousTag1', 'programs.religiousTag2', 'programs.religiousTag3'], dicts),
    excludedServicesJsonb: { ar: ['المصاريف الإضافية'], en: ['Optional extras'], es: ['Gastos opcionales'], pt: ['Extras opcionais'], it: ['Extra opzionali'] },
    minPaxJsonb: { ar: 'شخصين', en: '2 Pax', es: '2 Pax', pt: '2 Pax', it: '2 Pax' },
    departureInfoJsonb: { ar: 'يومي', en: 'Daily', es: 'Diario', pt: 'Diário', it: 'Giornaliero' },
    hotelInfoJsonb: { hotelCategory: '5 Star Luxury & Heritage Hotels' },
    sourceCodeJsonb: { source: 'services.js' },
    market: 'Global',
    sourceRating: 5.0,
    sourceReviewCount: 128,
    images: [
      { imageUrl: 'https://sft-nationaltours.com/wp-content/uploads/2024/11/holy-family-egypt_tg_1397-870x555.jpg', altText: 'Egypt & Jordan', sortOrder: 0 },
      { imageUrl: 'https://images.unsplash.com/photo-1548013146-72479768bada?w=1200&q=80', altText: 'Petra Treasury', sortOrder: 1 },
      { imageUrl: 'https://images.unsplash.com/photo-1509822929464-92b5d5e8827b?w=1200&q=80', altText: 'Sinai Desert', sortOrder: 2 },
      { imageUrl: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80', altText: 'Dead Sea & Mount Nebo', sortOrder: 3 },
    ],
    itinerary: holyFamilyItin,
  });

  // E. Hurghada Extension (4 Days)
  const hurghadaItin = [1,2,3,4].map(day => ({
    dayLabel: resolveKey(`trip.hurghada.day${day}.title`, 'en', dicts),
    descriptionJsonb: {
      ar: resolveKey(`trip.hurghada.day${day}.desc`, 'ar', dicts),
      en: resolveKey(`trip.hurghada.day${day}.desc`, 'en', dicts),
      es: resolveKey(`trip.hurghada.day${day}.desc`, 'es', dicts),
      pt: resolveKey(`trip.hurghada.day${day}.desc`, 'pt', dicts),
      it: resolveKey(`trip.hurghada.day${day}.desc`, 'it', dicts),
    },
    mealsJsonb: { ar: 'شامل كلياً', en: 'All Inclusive', es: 'Todo Incluido', pt: 'Tudo Incluído', it: 'Tutto Incluso' },
    sortOrder: day - 1,
  }));
  masterList.push({
    slug: 'hurghada-4d3n',
    sourceCatalogId: 'ahmed-group-19',
    country: 'Egypt',
    category: 'Beach',
    destinationSlug: 'egypt',
    titleJsonb: normalizeLocalizedText('trip.hurghada.title', dicts),
    subtitleJsonb: { ar: 'استجمام وسحر شواطئ البحر الأحمر الفاخرة', en: 'Luxury Red Sea Coastal Relaxation & Water Sports', es: 'Relax en las Playas de Lujo del Mar Rojo', pt: 'Relaxamento nas Praias de Luxo do Mar Vermelho', it: 'Relax sulle Spiagge di Lusso del Mar Rosso' },
    durationJsonb: { ar: '4 أيام / 3 ليالٍ', en: '4 Days / 3 Nights', es: '4 Días / 3 Noches', pt: '4 Dias / 3 Noites', it: '4 Giorni / 3 Notti' },
    overviewJsonb: normalizeLocalizedText('trip.hurghada.day1.desc', dicts),
    highlightsJsonb: normalizeLocalizedList(['trip.hurghada.day2.optional.title', 'trip.hurghada.day3.optional.title'], dicts),
    includedServicesJsonb: normalizeLocalizedList(['trip.hurghada.includes.item1', 'trip.hurghada.includes.item2'], dicts),
    excludedServicesJsonb: normalizeLocalizedList(['trip.hurghada.excludes.item1'], dicts),
    minPaxJsonb: { ar: 'شخصين', en: '2 Pax', es: '2 Pax', pt: '2 Pax', it: '2 Pax' },
    departureInfoJsonb: { ar: 'يومي', en: 'Daily', es: 'Diario', pt: 'Diário', it: 'Giornaliero' },
    hotelInfoJsonb: { hotelCategory: '5 Star All-Inclusive Beach Resort' },
    sourceCodeJsonb: { source: 'services.js' },
    market: 'Global',
    sourceRating: 5.0,
    sourceReviewCount: 96,
    images: [
      { imageUrl: 'https://1.bp.blogspot.com/-HqmKDzZ73hY/XgSOtrhSAOI/AAAAAAAARdc/cxtywSwZxLIaZPfw98FzQHYtiPblmzg2gCLcBGAsYHQ/w1200-h630-p-k-no-nu/%D8%A3%D9%81%D8%B6%D9%84-%D8%A7%D9%84%D8%A3%D9%86%D8%B4%D8%B7%D8%A9-%D8%A7%D9%84%D8%B3%D9%8A%D8%A7%D8%AD%D9%8A%D8%A9-%D9%81%D9%89-%D8%A7%D9%84%D8%BA%D8%B1%D8%AF%D9%82%D8%A9-825x510.jpg', altText: 'Hurghada Red Sea', sortOrder: 0 },
      { imageUrl: 'https://images.unsplash.com/photo-1544885935-98dd03b09034?auto=format&fit=crop&w=1200&q=80', altText: 'Hurghada Resort', sortOrder: 1 },
    ],
    itinerary: hurghadaItin,
  });

  // F. Sharm El Sheikh Extension (4 Days)
  const sharmItin = [1,2,3,4].map(day => ({
    dayLabel: resolveKey(`trip.sharm.day${day}.title`, 'en', dicts),
    descriptionJsonb: {
      ar: resolveKey(`trip.sharm.day${day}.desc`, 'ar', dicts),
      en: resolveKey(`trip.sharm.day${day}.desc`, 'en', dicts),
      es: resolveKey(`trip.sharm.day${day}.desc`, 'es', dicts),
      pt: resolveKey(`trip.sharm.day${day}.desc`, 'pt', dicts),
      it: resolveKey(`trip.sharm.day${day}.desc`, 'it', dicts),
    },
    mealsJsonb: { ar: 'شامل كلياً', en: 'All Inclusive', es: 'Todo Incluido', pt: 'Tudo Incluído', it: 'Tutto Incluso' },
    sortOrder: day - 1,
  }));
  masterList.push({
    slug: 'sharm-4d3n',
    sourceCatalogId: 'ahmed-group-20',
    country: 'Egypt',
    category: 'Beach',
    destinationSlug: 'egypt',
    titleJsonb: normalizeLocalizedText('trip.sharm.title', dicts),
    subtitleJsonb: { ar: 'منتجعات خليج نعمة والغوص في رأس محمد وسحر سيناء', en: 'Naama Bay Luxury Resorts, Ras Mohammed Diving & Sinai Magic', es: 'Resorts de Lujo en Naama Bay y Buceo en Ras Mohammed', pt: 'Resorts de Luxo em Naama Bay e Mergulho em Ras Mohammed', it: 'Resort di Lusso a Naama Bay e Immersioni a Ras Mohammed' },
    durationJsonb: { ar: '4 أيام / 3 ليالٍ', en: '4 Days / 3 Nights', es: '4 Días / 3 Noches', pt: '4 Dias / 3 Noites', it: '4 Giorni / 3 Notti' },
    overviewJsonb: normalizeLocalizedText('trip.sharm.day1.desc', dicts),
    highlightsJsonb: normalizeLocalizedList(['trip.sharm.day2.optional.title', 'trip.sharm.day3.optional.title'], dicts),
    includedServicesJsonb: normalizeLocalizedList(['trip.sharm.includes.item1', 'trip.sharm.includes.item2'], dicts),
    excludedServicesJsonb: normalizeLocalizedList(['trip.sharm.excludes.item1'], dicts),
    minPaxJsonb: { ar: 'شخصين', en: '2 Pax', es: '2 Pax', pt: '2 Pax', it: '2 Pax' },
    departureInfoJsonb: { ar: 'يومي', en: 'Daily', es: 'Diario', pt: 'Diário', it: 'Giornaliero' },
    hotelInfoJsonb: { hotelCategory: '5 Star All-Inclusive Beach & Spa Resort' },
    sourceCodeJsonb: { source: 'services.js' },
    market: 'Global',
    sourceRating: 5.0,
    sourceReviewCount: 112,
    images: [
      { imageUrl: 'https://nileholiday.com/wp-content/uploads/2019/10/sharm-el-sheikh-top-attractions-1-1920x750.jpg', altText: 'Sharm El Sheikh', sortOrder: 0 },
      { imageUrl: 'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?auto=format&fit=crop&w=1200&q=80', altText: 'Ras Mohammed Snorkeling', sortOrder: 1 },
    ],
    itinerary: sharmItin,
  });

  // G. Siwa Oasis & Alexandria Extension (5 Days)
  const siwaItin = [1,2,3,4,5].map(day => ({
    dayLabel: resolveKey(`tour_siwa_day${day}_title`, 'en', dicts),
    descriptionJsonb: {
      ar: resolveKey(`tour_siwa_day${day}_body`, 'ar', dicts),
      en: resolveKey(`tour_siwa_day${day}_body`, 'en', dicts),
      es: resolveKey(`tour_siwa_day${day}_body`, 'es', dicts),
      pt: resolveKey(`tour_siwa_day${day}_body`, 'pt', dicts),
      it: resolveKey(`tour_siwa_day${day}_body`, 'it', dicts),
    },
    mealsJsonb: null,
    sortOrder: day - 1,
  }));
  masterList.push({
    slug: 'siwa-oasis-alexandria',
    sourceCatalogId: 'prog-siwa-alex',
    country: 'Egypt',
    category: 'Desert Adventure',
    destinationSlug: 'egypt',
    titleJsonb: normalizeLocalizedText('tour_siwa_title', dicts),
    subtitleJsonb: { ar: 'مغامرة رمال الصحراء الكبرى وبحيرات الملح وعروس البحر المتوسط', en: 'Great Sand Sea Adventure, Salt Lakes & Mediterranean Pearl', es: 'Aventura en el Gran Mar de Arena, Lagos Salados y Alejandría', pt: 'Aventura no Grande Mar de Areia, Lagos Salgados e Alexandria', it: 'Avventura nel Gran Mare di Sabbia, Laghi Salati e Alessandria' },
    durationJsonb: { ar: '5 أيام / 4 ليالٍ', en: '5 Days / 4 Nights', es: '5 Días / 4 Noches', pt: '5 Dias / 4 Noites', it: '5 Giorni / 4 Notti' },
    overviewJsonb: normalizeLocalizedText('tour_siwa_summary', dicts),
    highlightsJsonb: { ar: ['بحيرات الملح وعيون كليوباترا', 'بحر الرمال الأعظم والتزلج على الرمال', 'قلعة شالي وجبل الموتى', 'مكتبة الإسكندرية وقلعة قايتباي'], en: ['Salt Lakes & Cleopatra Springs', 'Great Sand Sea Safari & Dune Bashing', 'Shali Fortress & Mountain of the Dead', 'Alexandria Library & Qaitbay Citadel'], es: ['Lagos Salados y Manantiales de Cleopatra', 'Safari en el Gran Mar de Arena', 'Fortaleza de Shali', 'Biblioteca de Alejandría'], pt: ['Lagos de Sal e Nascentes de Cleópatra', 'Safari no Grande Mar de Areia', 'Fortaleza de Shali', 'Biblioteca de Alexandria'], it: ['Laghi Salati e Sorgenti di Cleopatra', 'Safari nel Gran Mare di Sabbia', 'Fortezza di Shali', 'Biblioteca di Alessandria'] },
    includedServicesJsonb: normalizeLocalizedList(['tour_siwa_includes_1', 'tour_siwa_includes_2', 'tour_siwa_includes_3', 'tour_siwa_includes_4', 'tour_siwa_includes_5', 'tour_siwa_includes_6', 'tour_siwa_includes_7', 'tour_siwa_includes_8'], dicts),
    excludedServicesJsonb: { ar: ['المشروبات والنفقات الشخصية'], en: ['Drinks and personal expenses'], es: ['Bebidas y gastos personales'], pt: ['Bebidas e despesas pessoais'], it: ['Bevande e spese personali'] },
    minPaxJsonb: { ar: 'شخصين', en: '2 Pax', es: '2 Pax', pt: '2 Pax', it: '2 Pax' },
    departureInfoJsonb: { ar: 'أسبوعي / عند الطلب', en: 'Weekly / On Request', es: 'Semanal', pt: 'Semanal', it: 'Settimanale' },
    hotelInfoJsonb: { hotelCategory: 'Eco-Luxury Ecolodge in Siwa & 5 Star Alexandria' },
    sourceCodeJsonb: { source: 'services.js' },
    market: 'Global',
    sourceRating: 5.0,
    sourceReviewCount: 88,
    images: [
      { imageUrl: '/imgs/services/service-317.webp', altText: 'Siwa Oasis', sortOrder: 0 },
      { imageUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80', altText: 'Siwa Desert', sortOrder: 1 },
      { imageUrl: 'https://images.unsplash.com/photo-1572252009286-268acec5ca0a?auto=format&fit=crop&w=1200&q=80', altText: 'Alexandria Coast', sortOrder: 2 },
    ],
    itinerary: siwaItin,
  });

  // 3. Turkey Tours (15 tours)
  for (const tour of turkeyList) {
    const slug = cleanSlug(tour.slug || tour.id);
    const rawTitle = tour.title ?? tour.name;
    const images: string[] = Array.isArray(tour.images) ? tour.images : (tour.heroImage ? [tour.heroImage] : []);
    const itinDays: any[] = Array.isArray(tour.days) ? tour.days : (Array.isArray(tour.itinerary) ? tour.itinerary : []);

    masterList.push({
      slug,
      sourceCatalogId: tour.id,
      country: 'Turkey',
      category: 'Turkey',
      destinationSlug: 'turkey',
      titleJsonb: normalizeLocalizedText(rawTitle, dicts),
      subtitleJsonb: normalizeLocalizedText(tour.subtitle, dicts),
      durationJsonb: normalizeLocalizedText(tour.duration, dicts),
      overviewJsonb: normalizeLocalizedText(tour.overview ?? tour.description, dicts),
      highlightsJsonb: normalizeLocalizedList(tour.highlights, dicts),
      includedServicesJsonb: normalizeLocalizedList(tour.included ?? tour.includes, dicts),
      excludedServicesJsonb: normalizeLocalizedList(tour.excluded ?? tour.excludes, dicts),
      minPaxJsonb: normalizeLocalizedText(tour.minPax || '2 Pax', dicts),
      departureInfoJsonb: normalizeLocalizedText(tour.departures || 'Daily', dicts),
      hotelInfoJsonb: tour.hotels || tour.selectedHotels ? { hotels: tour.hotels, selectedHotels: tour.selectedHotels, category: tour.hotelCategory } : null,
      sourceCodeJsonb: tour,
      market: tour.market,
      sourceRating: tour.rating,
      sourceReviewCount: tour.reviewCount,
      images: images.map((imageUrl, sortOrder) => ({ imageUrl, altText: null, sortOrder })),
      itinerary: itinDays.map((d, sortOrder) => ({
        dayLabel: typeof d.title === 'string' ? resolveKey(d.title, 'en', dicts) : `Day ${sortOrder + 1}`,
        descriptionJsonb: normalizeLocalizedText(d.description ?? d.body, dicts),
        mealsJsonb: d.meals ? normalizeLocalizedText(d.meals, dicts) : null,
        sortOrder,
      })),
    });
  }

  // 4. Jordan Tours (7 tours)
  for (const tour of jordanList) {
    const slug = cleanSlug(tour.slug || tour.id);
    const rawTitle = tour.title ?? tour.name;
    const images: string[] = Array.isArray(tour.images) ? tour.images : (tour.heroImage ? [tour.heroImage] : []);
    const itinDays: any[] = Array.isArray(tour.days) ? tour.days : (Array.isArray(tour.itinerary) ? tour.itinerary : []);

    masterList.push({
      slug,
      sourceCatalogId: tour.id,
      country: 'Jordan',
      category: 'Jordan',
      destinationSlug: 'jordan',
      titleJsonb: normalizeLocalizedText(rawTitle, dicts),
      subtitleJsonb: normalizeLocalizedText(tour.subtitle, dicts),
      durationJsonb: normalizeLocalizedText(tour.duration, dicts),
      overviewJsonb: normalizeLocalizedText(tour.overview ?? tour.description, dicts),
      highlightsJsonb: normalizeLocalizedList(tour.highlights, dicts),
      includedServicesJsonb: normalizeLocalizedList(tour.included ?? tour.includes, dicts),
      excludedServicesJsonb: normalizeLocalizedList(tour.excluded ?? tour.excludes, dicts),
      minPaxJsonb: normalizeLocalizedText(tour.minPax || '2 Pax', dicts),
      departureInfoJsonb: normalizeLocalizedText(tour.departures || 'Daily', dicts),
      hotelInfoJsonb: tour.hotels || tour.selectedHotels ? { hotels: tour.hotels, selectedHotels: tour.selectedHotels, category: tour.hotelCategory } : null,
      sourceCodeJsonb: tour,
      market: tour.market,
      sourceRating: tour.rating,
      sourceReviewCount: tour.reviewCount,
      images: images.map((imageUrl, sortOrder) => ({ imageUrl, altText: null, sortOrder })),
      itinerary: itinDays.map((d, sortOrder) => ({
        dayLabel: typeof d.title === 'string' ? resolveKey(d.title, 'en', dicts) : `Day ${sortOrder + 1}`,
        descriptionJsonb: normalizeLocalizedText(d.description ?? d.body, dicts),
        mealsJsonb: d.meals ? normalizeLocalizedText(d.meals, dicts) : null,
        sortOrder,
      })),
    });
  }

  // 5. Dubai Tours (9 tours)
  for (const tour of dubaiList) {
    const rawTitle = tour.title ?? tour.name;
    const enTitle = typeof rawTitle === 'string' ? rawTitle : (rawTitle?.en ?? '');
    const slug = tour.slug ? cleanSlug(tour.slug) : cleanSlug(`${tour.id}-${enTitle}`);
    const tourIdUpper = (tour.id || '').toUpperCase();
    const fallbackImgs = programImages[tourIdUpper] || ['https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80'];
    const images: string[] = (Array.isArray(tour.images) && tour.images.length > 0) ? tour.images : (tour.heroImage ? [tour.heroImage] : fallbackImgs);
    const itinDays: any[] = Array.isArray(tour.days) ? tour.days : (Array.isArray(tour.itinerary) ? tour.itinerary : []);
    const isHM = (tour.id || '').toUpperCase().startsWith('HM');

    masterList.push({
      slug,
      sourceCatalogId: tour.id,
      country: 'United Arab Emirates',
      category: isHM ? 'Honeymoon' : 'United Arab Emirates',
      destinationSlug: 'dubai',
      titleJsonb: normalizeLocalizedText(rawTitle, dicts),
      subtitleJsonb: normalizeLocalizedText(tour.subtitle, dicts),
      durationJsonb: normalizeLocalizedText(tour.duration, dicts),
      overviewJsonb: normalizeLocalizedText(tour.overview ?? tour.description, dicts),
      highlightsJsonb: normalizeLocalizedList(tour.highlights, dicts),
      includedServicesJsonb: normalizeLocalizedList(tour.included ?? tour.includes, dicts),
      excludedServicesJsonb: normalizeLocalizedList(tour.excluded ?? tour.excludes, dicts),
      minPaxJsonb: normalizeLocalizedText(tour.minPax || '2 Pax', dicts),
      departureInfoJsonb: normalizeLocalizedText(tour.departures || 'Daily', dicts),
      hotelInfoJsonb: tour.hotels || tour.selectedHotels ? { hotels: tour.hotels, selectedHotels: tour.selectedHotels, category: tour.hotelCategory } : null,
      sourceCodeJsonb: tour,
      market: tour.market,
      sourceRating: tour.rating,
      sourceReviewCount: tour.reviewCount,
      images: images.map((imageUrl, sortOrder) => ({ imageUrl, altText: null, sortOrder })),
      itinerary: itinDays.map((d, sortOrder) => ({
        dayLabel: typeof d.title === 'string' ? resolveKey(d.title, 'en', dicts) : `Day ${sortOrder + 1}`,
        descriptionJsonb: normalizeLocalizedText(d.description ?? d.body, dicts),
        mealsJsonb: d.meals ? normalizeLocalizedText(d.meals, dicts) : null,
        sortOrder,
      })),
    });
  }

  // 6. Multi-Country Tours (9 tours)
  for (const tour of multiList) {
    const slug = cleanSlug(tour.slug || tour.id);
    const rawTitle = tour.title ?? tour.name;
    const images: string[] = Array.isArray(tour.images) ? tour.images : (tour.heroImage ? [tour.heroImage] : []);
    const itinDays: any[] = Array.isArray(tour.days) ? tour.days : (Array.isArray(tour.itinerary) ? tour.itinerary : []);

    masterList.push({
      slug,
      sourceCatalogId: tour.id,
      country: 'Multi-Country',
      category: 'Multi-Country',
      destinationSlug: 'multi-country',
      titleJsonb: normalizeLocalizedText(rawTitle, dicts),
      subtitleJsonb: normalizeLocalizedText(tour.subtitle, dicts),
      durationJsonb: normalizeLocalizedText(tour.duration, dicts),
      overviewJsonb: normalizeLocalizedText(tour.overview ?? tour.description, dicts),
      highlightsJsonb: normalizeLocalizedList(tour.highlights, dicts),
      includedServicesJsonb: normalizeLocalizedList(tour.included ?? tour.includes, dicts),
      excludedServicesJsonb: normalizeLocalizedList(tour.excluded ?? tour.excludes, dicts),
      minPaxJsonb: normalizeLocalizedText(tour.minPax || '2 Pax', dicts),
      departureInfoJsonb: normalizeLocalizedText(tour.departures || 'Daily', dicts),
      hotelInfoJsonb: tour.hotels || tour.selectedHotels ? { hotels: tour.hotels, selectedHotels: tour.selectedHotels, category: tour.hotelCategory } : null,
      sourceCodeJsonb: tour,
      market: tour.market,
      sourceRating: tour.rating,
      sourceReviewCount: tour.reviewCount,
      images: images.map((imageUrl, sortOrder) => ({ imageUrl, altText: null, sortOrder })),
      itinerary: itinDays.map((d, sortOrder) => ({
        dayLabel: typeof d.title === 'string' ? resolveKey(d.title, 'en', dicts) : `Day ${sortOrder + 1}`,
        descriptionJsonb: normalizeLocalizedText(d.description ?? d.body, dicts),
        mealsJsonb: d.meals ? normalizeLocalizedText(d.meals, dicts) : null,
        sortOrder,
      })),
    });
  }

  // Deduplicate by slug
  const uniqueBySlug = new Map<string, MasterTour>();
  for (const item of masterList) {
    if (!uniqueBySlug.has(item.slug)) {
      uniqueBySlug.set(item.slug, item);
    }
  }

  const result = Array.from(uniqueBySlug.values());
  return result;
}

export async function runMasterSync(execute: boolean = true) {
  const sourceDir = path.resolve(__dirname, '..', '..', 'DUNASTRAVEL-private-main', 'src', 'data');
  console.log(`Building master catalog from: ${sourceDir}`);
  const catalog = await buildMasterCatalog(sourceDir);
  console.log(`Master catalog generated: ${catalog.length} tours total.`);

  const egyptDirect = catalog.filter(t => t.country === 'Egypt');
  const multiEgypt = catalog.filter(t => t.country === 'Multi-Country' && t.slug !== 'marvels-of-dubai-and-turkey-14-days');
  console.log(`Egypt Direct Tours: ${egyptDirect.length}`);
  console.log(`Multi-Country with Egypt: ${multiEgypt.length}`);
  console.log(`Total Egypt-Related Catalog: ${egyptDirect.length + multiEgypt.length}`);

  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@127.0.0.1:5432/dunastravel_db';
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const destinationPages = await prisma.tourLandingPage.findMany({
      where: { deletedAt: null, type: 'DESTINATION' },
      select: { id: true, slug: true },
    });
    const destPageMap = new Map(destinationPages.map(p => [p.slug.toLowerCase(), p.id]));

    if (execute) {
      console.log('Cleaning up any obsolete temporary placeholder slugs...');
      await prisma.tour.deleteMany({
        where: { slug: { in: ['hurghada-escape', 'sharm-el-sheikh-escape', 'reg-22', 'reg-23', 'reg-24', 'reg-25', 'reg-26', 'reg-27', 'reg-28', 'hm001', 'hm002'] } },
      });

      console.log('Synchronizing all 59 tours...');
      let count = 0;
      for (const tour of catalog) {
        count++;
        const destId = destPageMap.get(tour.destinationSlug.toLowerCase());
        const json = (val: any) => val as Prisma.InputJsonValue;

        const tourPayload = {
          titleJsonb: json(tour.titleJsonb),
          subtitleJsonb: json(tour.subtitleJsonb),
          durationJsonb: json(tour.durationJsonb),
          overviewJsonb: json(tour.overviewJsonb),
          highlightsJsonb: json(tour.highlightsJsonb),
          includedServicesJsonb: json(tour.includedServicesJsonb),
          excludedServicesJsonb: json(tour.excludedServicesJsonb),
          minPaxJsonb: json(tour.minPaxJsonb),
          departureInfoJsonb: json(tour.departureInfoJsonb),
          hotelInfoJsonb: tour.hotelInfoJsonb ? json(tour.hotelInfoJsonb) : Prisma.JsonNull,
          sourceCodeJsonb: json(tour.sourceCodeJsonb),
          category: tour.category,
          country: tour.country,
          market: tour.market || 'Global',
          sourceRating: tour.sourceRating !== undefined ? new Prisma.Decimal(tour.sourceRating) : new Prisma.Decimal(4.9),
          sourceReviewCount: tour.sourceReviewCount || 100,
          sourceCatalogId: tour.sourceCatalogId,
          isActive: true,
          status: 'PUBLISHED',
          deletedAt: null,
          tags: ['dunas-master-source', tour.country.toLowerCase(), tour.destinationSlug.toLowerCase()],
        };

        const existing = await prisma.tour.findFirst({
          where: { OR: [{ slug: tour.slug }, { sourceCatalogId: tour.sourceCatalogId }] },
          select: { id: true },
        });

        let tourRecordId = '';
        if (existing) {
          tourRecordId = existing.id;
          await prisma.tour.update({
            where: { id: existing.id },
            data: {
              ...tourPayload,
              slug: tour.slug,
            },
          });
        } else {
          const created = await prisma.tour.create({
            data: {
              ...tourPayload,
              slug: tour.slug,
              basePriceUsd: new Prisma.Decimal(0),
              currency: 'USD',
            },
          });
          tourRecordId = created.id;
        }

        // Images
        await prisma.tourImage.deleteMany({ where: { tourId: tourRecordId } });
        if (tour.images.length > 0) {
          await prisma.tourImage.createMany({
            data: tour.images.map((img, idx) => ({
              tourId: tourRecordId,
              imageUrl: img.imageUrl,
              altText: img.altText,
              isHero: idx === 0,
              sortOrder: img.sortOrder,
            })),
          });
        }

        // Itineraries
        await prisma.tourItinerary.deleteMany({ where: { tourId: tourRecordId } });
        if (tour.itinerary.length > 0) {
          await prisma.tourItinerary.createMany({
            data: tour.itinerary.map((itin) => ({
              tourId: tourRecordId,
              dayLabel: itin.dayLabel ? itin.dayLabel.slice(0, 50) : null,
              descriptionJsonb: json(itin.descriptionJsonb),
              mealsJsonb: itin.mealsJsonb ? json(itin.mealsJsonb) : Prisma.JsonNull,
              sortOrder: itin.sortOrder,
            })),
          });
        }

        // Landing Pages
        await prisma.tourLandingPageTour.deleteMany({ where: { tourId: tourRecordId } });
        const pagesToLink = [tour.destinationSlug, ...(tour.additionalLandingPages || [])];
        for (const pageSlug of pagesToLink) {
          const pageId = destPageMap.get(pageSlug.toLowerCase());
          if (pageId) {
            await prisma.tourLandingPageTour.create({
              data: {
                tourId: tourRecordId,
                landingPageId: pageId,
                sortOrder: 0,
                isFeatured: false,
                isVisible: true,
              },
            });
          }
        }

        console.log(`[${count}/${catalog.length}] Synced: ${tour.slug} (${tour.country} / ${tour.category})`);
      }

      console.log('✅ ALL 59 TOURS FULLY SYNCHRONIZED!');
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

if (require.main === module) {
  const execute = process.argv.includes('--execute');
  runMasterSync(execute).catch((err) => {
    console.error('Sync failed:', err);
    process.exit(1);
  });
}
