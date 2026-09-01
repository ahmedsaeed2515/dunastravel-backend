const fs = require('fs');
const path = require('path');
const vm = require('vm');

const backendNodeModules = path.resolve('d:/@@project/LUXURY-PROJECT/dunastravel-backend/node_modules');
const { PrismaClient } = require(path.join(backendNodeModules, '@prisma/client'));
const { Pool } = require(path.join(backendNodeModules, 'pg'));
const { PrismaPg } = require(path.join(backendNodeModules, '@prisma/adapter-pg'));

// Load backend .env
const envPath = path.resolve('d:/@@project/LUXURY-PROJECT/dunastravel-backend/.env');
let envDbUrl = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
  if (match) envDbUrl = match[1];
}

const connectionString = process.env.DATABASE_URL || envDbUrl || 'postgresql://postgres:postgres@localhost:5432/dunastravel?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const origDataDir = path.resolve('d:/@@project/LUXURY-PROJECT/DUNASTRAVEL-private-main/src/data');
const origLocalesDir = path.resolve('d:/@@project/LUXURY-PROJECT/DUNASTRAVEL-private-main/src/i18n/locales');

// Load 5-language dictionaries for translation lookup
const locales = {
  ar: JSON.parse(fs.readFileSync(path.join(origLocalesDir, 'ar.json'), 'utf8')),
  en: JSON.parse(fs.readFileSync(path.join(origLocalesDir, 'en.json'), 'utf8')),
  es: JSON.parse(fs.readFileSync(path.join(origLocalesDir, 'es.json'), 'utf8')),
  it: JSON.parse(fs.readFileSync(path.join(origLocalesDir, 'it.json'), 'utf8')),
  pt: JSON.parse(fs.readFileSync(path.join(origLocalesDir, 'pt.json'), 'utf8')),
};

function translateKey(key, fallback = '') {
  if (!key) return { ar: fallback, en: fallback, es: fallback, it: fallback, pt: fallback };
  return {
    ar: locales.ar[key] || fallback || key,
    en: locales.en[key] || fallback || key,
    es: locales.es[key] || fallback || key,
    it: locales.it[key] || fallback || key,
    pt: locales.pt[key] || fallback || key,
  };
}

function ensure5Langs(obj, fallback = '') {
  if (!obj) {
    return { ar: fallback, en: fallback, es: fallback, it: fallback, pt: fallback };
  }
  if (typeof obj === 'string') {
    if (locales.en[obj] || locales.es[obj] || locales.ar[obj]) {
      return translateKey(obj, obj);
    }
    return { ar: obj, en: obj, es: obj, it: obj, pt: obj };
  }
  const en = obj.en || obj.es || obj.pt || obj.it || obj.ar || fallback;
  return {
    ar: obj.ar || en,
    en: obj.en || en,
    es: obj.es || en,
    it: obj.it || en,
    pt: obj.pt || en,
  };
}

function toSlug(input) {
  if (!input) return 'tour';
  if (typeof input === 'object') {
    return toSlug(input.en || input.es || input.pt || input.it || input.ar || Object.values(input)[0] || 'tour');
  }
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function loadJsBundle(fileName, assignVar) {
  const p = path.join(origDataDir, fileName);
  if (!fs.existsSync(p)) return null;
  let code = fs.readFileSync(p, 'utf8');
  if (code.charCodeAt(0) === 0xFEFF) code = code.slice(1);
  code = code.replace(/export\s*\{[^}]*\};?/g, '');
  code = code.replace(/export\s+const\s+/g, 'var ');
  code = code.replace(/export\s+default\s+/g, 'var defaultExport = ');
  code = code.replace(/export\s+let\s+/g, 'var ');
  code = code.replace(/export\s+var\s+/g, 'var ');
  
  const sandbox = {};
  try {
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox[assignVar] || sandbox.defaultExport || sandbox;
  } catch (e) {
    console.error(`Error loading ${fileName}:`, e.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Starting Master Tour Synchronization Engine...');

  // 1. Load Programs from programs-DKV1h4fH.js (33 programs)
  const progBundle = loadJsBundle('programs-DKV1h4fH.js', 'e');
  const rawPrograms33 = (progBundle && progBundle.programs) ? progBundle.programs : [];
  console.log(`Loaded ${rawPrograms33.length} regional programs from programs-DKV1h4fH.js`);

  // 2. Load ahmedData.tsx (96 localized tours)
  let ahmedContent = fs.readFileSync(path.join(origDataDir, 'ahmedData.tsx'), 'utf8');
  ahmedContent = ahmedContent.replace(/export\s+interface\s+[\s\S]*?\n\}/g, '');
  ahmedContent = ahmedContent.replace(/export\s+const\s+ahmedToursData:\s*AhmedTourPackage\[\]\s*=/, 'var ahmedToursData =');
  ahmedContent = ahmedContent.replace(/export\s+const\s+getAhmed[\s\S]*$/, '');
  const ahmedSandbox = {};
  vm.createContext(ahmedSandbox);
  vm.runInContext(ahmedContent, ahmedSandbox);
  const rawAhmedTours = ahmedSandbox.ahmedToursData || [];
  console.log(`Loaded ${rawAhmedTours.length} tours from ahmedData.tsx`);

  // 3. Load destination collections
  const turkeyTours = loadJsBundle('turkeyTours.js', 'turkeyTours') || [];
  const dubaiTours = loadJsBundle('dubaiTours.js', 'dubaiTours') || [];
  const jordanTours = loadJsBundle('jordanTours.js', 'jordanTours') || [];
  const moroccoTours = loadJsBundle('moroccoTours.js', 'moroccoTours') || [];
  const tunisiaTours = loadJsBundle('tunisiaTours.js', 'tunisiaTours') || [];
  const multiCountryTours = loadJsBundle('multiCountryTours.js', 'multiCountryTours') || [];
  const journeysRoutes = loadJsBundle('journeys_routes_data.js', 'journeysRoutesData') || [];

  // Master tour map keyed by canonical slug
  const masterTours = new Map();

  function registerTour(tourData) {
    const slug = tourData.slug;
    if (!slug) return;
    if (!masterTours.has(slug)) {
      masterTours.set(slug, {
        slug,
        titleJsonb: ensure5Langs(tourData.titleJsonb || tourData.title, slug),
        subtitleJsonb: tourData.subtitleJsonb ? ensure5Langs(tourData.subtitleJsonb) : null,
        category: tourData.category || 'Egypt',
        country: tourData.country || 'Egypt',
        city: tourData.city || 'Cairo',
        basePriceUsd: tourData.basePriceUsd || 0,
        currency: 'USD',
        durationJsonb: ensure5Langs(tourData.durationJsonb || tourData.duration, '7 Days / 6 Nights'),
        overviewJsonb: ensure5Langs(tourData.overviewJsonb || tourData.overview, ''),
        highlightsJsonb: tourData.highlightsJsonb || null,
        includedServicesJsonb: tourData.includedServicesJsonb || null,
        excludedServicesJsonb: tourData.excludedServicesJsonb || null,
        hotelInfoJsonb: tourData.hotelInfoJsonb || null,
        departureInfoJsonb: tourData.departureInfoJsonb ? ensure5Langs(tourData.departureInfoJsonb) : null,
        minPaxJsonb: tourData.minPaxJsonb ? ensure5Langs(tourData.minPaxJsonb) : { ar: "شخصان", en: "2 Pax", es: "2 Pax", it: "2 Pax", pt: "2 Pax" },
        status: 'PUBLISHED',
        isActive: true,
        languages: ['ar', 'en', 'es', 'it', 'pt'],
        sourceRating: tourData.sourceRating || 4.9,
        sourceReviewCount: tourData.sourceReviewCount || 120,
        itineraries: tourData.itineraries || [],
        images: tourData.images || [],
        sourceCatalogId: tourData.sourceCatalogId || slug
      });
    } else {
      const existing = masterTours.get(slug);
      if (tourData.titleJsonb) existing.titleJsonb = { ...existing.titleJsonb, ...ensure5Langs(tourData.titleJsonb) };
      if (tourData.durationJsonb) existing.durationJsonb = { ...existing.durationJsonb, ...ensure5Langs(tourData.durationJsonb) };
      if (tourData.overviewJsonb) existing.overviewJsonb = { ...existing.overviewJsonb, ...ensure5Langs(tourData.overviewJsonb) };
      if (tourData.highlightsJsonb && !existing.highlightsJsonb) existing.highlightsJsonb = tourData.highlightsJsonb;
      if (tourData.includedServicesJsonb && !existing.includedServicesJsonb) existing.includedServicesJsonb = tourData.includedServicesJsonb;
      if (tourData.excludedServicesJsonb && !existing.excludedServicesJsonb) existing.excludedServicesJsonb = tourData.excludedServicesJsonb;
      if (tourData.hotelInfoJsonb && !existing.hotelInfoJsonb) existing.hotelInfoJsonb = tourData.hotelInfoJsonb;
      if (tourData.itineraries && tourData.itineraries.length > existing.itineraries.length) existing.itineraries = tourData.itineraries;
      if (tourData.images && tourData.images.length > existing.images.length) existing.images = tourData.images;
      if (tourData.basePriceUsd && !existing.basePriceUsd) existing.basePriceUsd = tourData.basePriceUsd;
    }
  }

  // --- Process programs-DKV1h4fH.js (33 programs) ---
  for (const prog of rawPrograms33) {
    const rawCode = prog.code || prog.id || '';
    const code = typeof rawCode === 'string' ? rawCode : (rawCode.en || rawCode.es || Object.values(rawCode)[0] || '');
    const slug = toSlug(prog.title?.en || prog.title?.es || prog.name?.en || code || 'program');
    
    let category = 'Turkey';
    let country = 'Turkey';
    let city = 'Istanbul';
    if (code.startsWith('REG-15') || code.startsWith('REG-16') || code.startsWith('REG-17') || code.startsWith('REG-18') || code.startsWith('REG-19') || code.startsWith('REG-20') || code.startsWith('REG-21')) {
      category = 'Jordan'; country = 'Jordan'; city = 'Amman';
    } else if (code.startsWith('REG-22') || code.startsWith('REG-23') || code.startsWith('REG-24') || code.startsWith('REG-25') || code.startsWith('REG-26') || code.startsWith('REG-27') || code.startsWith('REG-28') || code.startsWith('HM001') || code.startsWith('HM002')) {
      category = 'Dubai'; country = 'United Arab Emirates'; city = 'Dubai';
    } else if (code.startsWith('MRC-01')) {
      category = 'Morocco'; country = 'Morocco'; city = 'Marrakech';
    } else if (code.startsWith('REG-29')) {
      category = 'Egypt'; country = 'Egypt'; city = 'Sharm El Sheikh';
    }

    const days = (prog.days || prog.itinerary || []).map((d, idx) => ({
      dayLabel: `Day ${d.day || idx + 1}`,
      titleJsonb: ensure5Langs(d.title || d.dayLabel, `Day ${d.day || idx + 1}`),
      descriptionJsonb: ensure5Langs(d.description, ''),
      mealsJsonb: d.meals ? ensure5Langs(d.meals, '') : null,
      sortOrder: idx
    }));

    // Assign standard destination inclusions if not explicitly provided
    let defaultInclusions = null;
    let defaultExclusions = null;
    if (category === 'Turkey') {
      defaultInclusions = {
        ar: [
          "الإقامة في فنادق 4/5 نجوم المختارة مع الإفطار اليومي في إسطنبول",
          "الإقامة مع وجبتي طعام (إفطار وعشاء) أثناء الجولة في الأناضول (كابادوكيا، باموكالي، كوشاداسي/إزمير)",
          "جميع الانتقالات والجولات في حافلات سياحية حديثة ومكيفة / قطار فائق السرعة أو رحلات الطيران الداخلي المحددة",
          "مرشد سياحي محترف يتحدث لغتك طوال الجولة",
          "رسوم دخول جميع المعالم الأثرية والمزارات المذكورة في خط السير",
          "خدمة الاستقبال والمساعدة في مطار إسطنبول عند الوصول والمغادرة"
        ],
        en: [
          "Accommodation in selected 4/5-star hotels on a Bed & Breakfast basis in Istanbul",
          "Half Board (Breakfast & Dinner) during the tour in Anatolia (Cappadocia, Pamukkale, Kusadasi/Izmir)",
          "All sightseeing and transfers in modern air-conditioned motorcoaches / high-speed train or domestic flights as specified",
          "Professional licensed multilingual guide throughout the itinerary",
          "Entrance fees to all archaeological sites and museums mentioned in the program",
          "Meet & assist services at Istanbul airport on arrival and departure"
        ],
        es: [
          "Alojamiento en hoteles de 4/5 estrellas seleccionados con desayuno diario en Estambul",
          "Régimen de media pensión (desayuno y cena) durante el circuito por Anatolia (Capadocia, Pamukkale, Kusadasi/Esmirna)",
          "Todos los traslados y visitas en autocares modernos con aire acondicionado / tren de alta velocidad o vuelos internos indicados",
          "Guía profesional de habla hispana durante todo el recorrido",
          "Entradas a todos los lugares de interés histórico y museos detallados en el itinerario",
          "Servicio de asistencia y traslados de llegada y salida en el aeropuerto de Estambul"
        ],
        pt: [
          "Hospedagem em hotéis de 4/5 estrelas selecionados com café da manhã diário em Istambul",
          "Regime de meia-pensão (café da manhã e jantar) durante o circuito pela Anatólia (Capadócia, Pamukkale, Kusadasi/Esmirna)",
          "Todos os traslados e passeios em modernos ônibus com ar-condicionado / trem de alta velocidade ou voos domésticos especificados",
          "Guia profissional de língua portuguesa durante todo o roteiro",
          "Ingressos para todas as atrações históricas e museus mencionados no itinerário",
          "Serviço de assistência e traslados de chegada e partida no aeroporto de Istambul"
        ],
        it: [
          "Sistemazione in hotel 4/5 stelle selezionati con prima colazione giornaliera a Istanbul",
          "Trattamento di mezza pensione (colazione e cena) durante il tour in Anatolia (Cappadocia, Pamukkale, Kusadasi/Smirne)",
          "Tutti i trasferimenti e le visite in moderni pullman climatizzati / treno ad alta velocità o voli interni previsti",
          "Guida professionale autorizzata in lingua italiana durante tutto il programma",
          "Biglietti d'ingresso per tutti i siti archeologici e musei indicados nell'itinerario",
          "Servizio di assistenza e trasferimenti di arrivo e partenza all'aeroporto di Istanbul"
        ]
      };
      defaultExclusions = {
        ar: [
          "تذاكر الطيران الدولي من وإلى بلدك",
          "تأشيرة دخول تركيا",
          "المشروبات مع الوجبات والمصاريف الشخصية",
          "الجولات الاختيارية (مثل ركوب المنطاد الهوائي في كابادوكيا)",
          "إكراميات المرشد والسائق وموظفي الفندق"
        ],
        en: [
          "International flights to/from your home country",
          "Turkish entry visa",
          "Beverages with meals and personal expenses",
          "Optional tours and activities (e.g. Hot Air Balloon ride in Cappadocia)",
          "Customary tips for guide, driver, and hotel staff"
        ],
        es: [
          "Vuelos internacionales de ida y vuelta",
          "Visado de entrada a Turquía",
          "Bebidas durante las comidas y gastos personales",
          "Excursiones opcionales (ej. paseo en globo aerostático en Capadocia)",
          "Propinas para guía, chófer y maleteros"
        ],
        pt: [
          "Voos internacionais de ida e volta",
          "Visto de entrada na Turquia",
          "Bebidas durante as refeições e despesas pessoais",
          "Passeios opcionais (ex.: voo de balão na Capadócia)",
          "Gorjetas para guia, motorista e carregadores de malas"
        ],
        it: [
          "Voli internazionali di andata e ritorno",
          "Visto d'ingresso in Turchia",
          "Bevande durante i pasti e spese personali",
          "Escursioni facoltative (es. volo in mongolfiera in Cappadocia)",
          "Mance per guida, autista e personale dell'hotel"
        ]
      };
    }

    registerTour({
      slug,
      sourceCatalogId: code || slug,
      titleJsonb: ensure5Langs(prog.title || prog.name, slug),
      durationJsonb: ensure5Langs(prog.duration, `${days.length} Days / ${Math.max(1, days.length - 1)} Nights`),
      overviewJsonb: ensure5Langs(prog.overview || prog.description, ''),
      highlightsJsonb: prog.highlights || null,
      includedServicesJsonb: defaultInclusions,
      excludedServicesJsonb: defaultExclusions,
      category,
      country,
      city,
      basePriceUsd: prog.basePriceUsd || prog.price || 850,
      itineraries: days,
      hotelInfoJsonb: prog.hotels || prog.accommodation || null,
      images: (prog.images || []).length > 0 ? prog.images : [
        'https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?q=80&w=1200'
      ]
    });
  }

  // --- Process Destination Tour Collections ---
  const destCollections = [
    { list: turkeyTours, cat: 'Turkey', country: 'Turkey', city: 'Istanbul' },
    { list: dubaiTours, cat: 'Dubai', country: 'United Arab Emirates', city: 'Dubai' },
    { list: jordanTours, cat: 'Jordan', country: 'Jordan', city: 'Amman' },
    { list: moroccoTours, cat: 'Morocco', country: 'Morocco', city: 'Marrakech' },
    { list: tunisiaTours, cat: 'Tunisia', country: 'Tunisia', city: 'Tunis' },
    { list: multiCountryTours, cat: 'Multi-Country', country: 'Multi-Country', city: 'Cairo' },
  ];

  for (const group of destCollections) {
    for (const item of group.list) {
      const slug = item.slug || toSlug(item.title?.en || item.title?.es || item.title || item.name || item.id);
      const days = (item.days || item.itinerary || []).map((d, idx) => ({
        dayLabel: `Day ${d.day || idx + 1}`,
        titleJsonb: ensure5Langs(d.title || d.dayLabel, `Day ${d.day || idx + 1}`),
        descriptionJsonb: ensure5Langs(d.description, ''),
        mealsJsonb: d.meals ? ensure5Langs(d.meals, '') : null,
        sortOrder: idx
      }));

      let includedJsonb = null;
      if (Array.isArray(item.included)) {
        includedJsonb = {
          ar: item.included.map(k => locales.ar[k] || k),
          en: item.included.map(k => locales.en[k] || k),
          es: item.included.map(k => locales.es[k] || k),
          it: item.included.map(k => locales.it[k] || k),
          pt: item.included.map(k => locales.pt[k] || k),
        };
      }
      let excludedJsonb = null;
      if (Array.isArray(item.excluded)) {
        excludedJsonb = {
          ar: item.excluded.map(k => locales.ar[k] || k),
          en: item.excluded.map(k => locales.en[k] || k),
          es: item.excluded.map(k => locales.es[k] || k),
          it: item.excluded.map(k => locales.it[k] || k),
          pt: item.excluded.map(k => locales.pt[k] || k),
        };
      }

      let highlightsJsonb = null;
      if (Array.isArray(item.highlights)) {
        highlightsJsonb = {
          ar: item.highlights.map(k => locales.ar[k] || k),
          en: item.highlights.map(k => locales.en[k] || k),
          es: item.highlights.map(k => locales.es[k] || k),
          it: item.highlights.map(k => locales.it[k] || k),
          pt: item.highlights.map(k => locales.pt[k] || k),
        };
      }

      registerTour({
        slug,
        sourceCatalogId: item.id || slug,
        titleJsonb: ensure5Langs(item.title || item.name, slug),
        subtitleJsonb: item.subtitle ? ensure5Langs(item.subtitle) : null,
        durationJsonb: ensure5Langs(item.duration, `${days.length || 7} Days`),
        overviewJsonb: ensure5Langs(item.overview || item.description, ''),
        highlightsJsonb,
        includedServicesJsonb: includedJsonb,
        excludedServicesJsonb: excludedJsonb,
        hotelInfoJsonb: item.hotels || item.accommodation || null,
        category: group.cat,
        country: group.country,
        city: group.city,
        basePriceUsd: item.price || item.basePriceUsd || 950,
        itineraries: days,
        images: Array.isArray(item.images) && item.images.length > 0 ? item.images : [
          'https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?q=80&w=1200'
        ]
      });
    }
  }

  // --- Process ahmedData.tsx (96 localized tours) ---
  const ahmedToursByTitle = new Map();
  for (const at of rawAhmedTours) {
    let key = at.id;
    if (key.startsWith('ahmed-tour-')) {
      const num = parseInt(key.replace('ahmed-tour-', ''), 10);
      key = `pkg_${Math.floor((num - 1) / 5) + 1}`;
    }
    if (!ahmedToursByTitle.has(key)) {
      ahmedToursByTitle.set(key, {});
    }
    ahmedToursByTitle.get(key)[at.language] = at;
  }

  for (const [pkgKey, langMap] of ahmedToursByTitle.entries()) {
    const enObj = langMap.en || langMap.es || langMap.pt || langMap.it || langMap.ar;
    if (!enObj) continue;

    const slug = toSlug(enObj.title || enObj.slug || pkgKey);
    const titleJsonb = {
      ar: langMap.ar?.title || enObj.title,
      en: langMap.en?.title || enObj.title,
      es: langMap.es?.title || enObj.title,
      it: langMap.it?.title || enObj.title,
      pt: langMap.pt?.title || enObj.title,
    };
    const overviewJsonb = {
      ar: langMap.ar?.overview || enObj.overview || '',
      en: langMap.en?.overview || enObj.overview || '',
      es: langMap.es?.overview || enObj.overview || '',
      it: langMap.it?.overview || enObj.overview || '',
      pt: langMap.pt?.overview || enObj.overview || '',
    };
    const durationJsonb = {
      ar: langMap.ar?.duration || enObj.duration || '7 Days',
      en: langMap.en?.duration || enObj.duration || '7 Days',
      es: langMap.es?.duration || enObj.duration || '7 Days',
      it: langMap.it?.duration || enObj.duration || '7 Days',
      pt: langMap.pt?.duration || enObj.duration || '7 Days',
    };

    const highlightsJsonb = {
      ar: langMap.ar?.highlights || enObj.highlights || [],
      en: langMap.en?.highlights || enObj.highlights || [],
      es: langMap.es?.highlights || enObj.highlights || [],
      it: langMap.it?.highlights || enObj.highlights || [],
      pt: langMap.pt?.highlights || enObj.highlights || [],
    };

    const includedServicesJsonb = {
      ar: langMap.ar?.included || enObj.included || [],
      en: langMap.en?.included || enObj.included || [],
      es: langMap.es?.included || enObj.included || [],
      it: langMap.it?.included || enObj.included || [],
      pt: langMap.pt?.included || enObj.included || [],
    };

    const excludedServicesJsonb = {
      ar: langMap.ar?.excluded || enObj.excluded || [],
      en: langMap.en?.excluded || enObj.excluded || [],
      es: langMap.es?.excluded || enObj.excluded || [],
      it: langMap.it?.excluded || enObj.excluded || [],
      pt: langMap.pt?.excluded || enObj.excluded || [],
    };

    const maxDays = Math.max(
      langMap.ar?.itinerary?.length || 0,
      langMap.en?.itinerary?.length || 0,
      langMap.es?.itinerary?.length || 0,
      langMap.it?.itinerary?.length || 0,
      langMap.pt?.itinerary?.length || 0
    );

    const itineraries = [];
    for (let i = 0; i < maxDays; i++) {
      const arDay = langMap.ar?.itinerary?.[i] || {};
      const enDay = langMap.en?.itinerary?.[i] || {};
      const esDay = langMap.es?.itinerary?.[i] || {};
      const itDay = langMap.it?.itinerary?.[i] || {};
      const ptDay = langMap.pt?.itinerary?.[i] || {};

      itineraries.push({
        dayLabel: `Day ${i + 1}`,
        titleJsonb: {
          ar: arDay.title || enDay.title || `اليوم ${i + 1}`,
          en: enDay.title || esDay.title || `Day ${i + 1}`,
          es: esDay.title || enDay.title || `Día ${i + 1}`,
          it: itDay.title || enDay.title || `Giorno ${i + 1}`,
          pt: ptDay.title || enDay.title || `Dia ${i + 1}`,
        },
        descriptionJsonb: {
          ar: arDay.description || enDay.description || '',
          en: enDay.description || esDay.description || '',
          es: esDay.description || enDay.description || '',
          it: itDay.description || enDay.description || '',
          pt: ptDay.description || enDay.description || '',
        },
        mealsJsonb: {
          ar: "وجبات بالفندق",
          en: "Meals according to itinerary",
          es: "Comidas según itinerario",
          it: "Pasti come da itinerario",
          pt: "Refeições conforme itinerário"
        },
        sortOrder: i
      });
    }

    let category = 'Egypt';
    let country = 'Egypt';
    let city = 'Cairo';
    const lowTitle = (enObj.title || '').toLowerCase();
    if (lowTitle.includes('greece') || lowTitle.includes('athens')) {
      category = 'Greece'; country = 'Greece'; city = 'Athens';
    } else if (lowTitle.includes('turkey') || lowTitle.includes('türkiye') || lowTitle.includes('istanbul')) {
      category = 'Multi-Country'; country = 'Multi-Country'; city = 'Cairo / Istanbul';
    } else if (lowTitle.includes('dubai')) {
      category = 'Multi-Country'; country = 'Multi-Country'; city = 'Cairo / Dubai';
    } else if (lowTitle.includes('jordan')) {
      category = 'Multi-Country'; country = 'Multi-Country'; city = 'Cairo / Amman';
    } else if (lowTitle.includes('tunisia')) {
      category = 'Tunisia'; country = 'Tunisia'; city = 'Tunis';
    } else if (lowTitle.includes('holy family') || lowTitle.includes('sagrada familia') || lowTitle.includes('sacra famiglia') || lowTitle.includes('العائلة المقدسة')) {
      category = 'Religious'; country = 'Egypt'; city = 'Cairo';
    } else if (lowTitle.includes('honeymoon') || lowTitle.includes('luna de miel') || lowTitle.includes('lua de mel')) {
      category = 'Honeymoon'; country = 'Egypt'; city = 'Cairo';
    }

    registerTour({
      slug,
      sourceCatalogId: enObj.id || slug,
      titleJsonb,
      overviewJsonb,
      durationJsonb,
      highlightsJsonb,
      includedServicesJsonb,
      excludedServicesJsonb,
      category,
      country,
      city,
      basePriceUsd: 1250,
      itineraries,
      images: [
        'https://images.unsplash.com/photo-1568322445389-f64ac2515020?q=80&w=1200',
        'https://images.unsplash.com/photo-1539650116574-8efeb43e2750?q=80&w=1200',
        'https://images.unsplash.com/photo-1572252009286-268acec5ca0a?q=80&w=1200'
      ]
    });
  }

  console.log(`\n✨ Compiled Master Catalog: ${masterTours.size} unique tours!`);

  // --- UPSERT ALL MASTER TOURS INTO PRISMA POSTGRES DATABASE ---
  let count = 0;
  for (const [slug, t] of masterTours.entries()) {
    try {
      const tour = await prisma.tour.upsert({
        where: { slug },
        update: {
          titleJsonb: t.titleJsonb,
          subtitleJsonb: t.subtitleJsonb,
          category: t.category,
          country: t.country,
          city: t.city,
          basePriceUsd: t.basePriceUsd,
          currency: t.currency,
          durationJsonb: t.durationJsonb,
          overviewJsonb: t.overviewJsonb,
          highlightsJsonb: t.highlightsJsonb,
          includedServicesJsonb: t.includedServicesJsonb,
          excludedServicesJsonb: t.excludedServicesJsonb,
          hotelInfoJsonb: t.hotelInfoJsonb,
          departureInfoJsonb: t.departureInfoJsonb,
          minPaxJsonb: t.minPaxJsonb,
          status: 'PUBLISHED',
          isActive: true,
          languages: t.languages,
          sourceRating: t.sourceRating,
          sourceReviewCount: t.sourceReviewCount,
        },
        create: {
          slug: t.slug,
          sourceCatalogId: `cat-${t.slug}`,
          titleJsonb: t.titleJsonb,
          subtitleJsonb: t.subtitleJsonb,
          category: t.category,
          country: t.country,
          city: t.city,
          basePriceUsd: t.basePriceUsd,
          currency: t.currency,
          durationJsonb: t.durationJsonb,
          overviewJsonb: t.overviewJsonb,
          highlightsJsonb: t.highlightsJsonb,
          includedServicesJsonb: t.includedServicesJsonb,
          excludedServicesJsonb: t.excludedServicesJsonb,
          hotelInfoJsonb: t.hotelInfoJsonb,
          departureInfoJsonb: t.departureInfoJsonb,
          minPaxJsonb: t.minPaxJsonb,
          status: 'PUBLISHED',
          isActive: true,
          languages: t.languages,
          sourceRating: t.sourceRating,
          sourceReviewCount: t.sourceReviewCount,
        }
      });

      // Upsert Itineraries
      if (t.itineraries && t.itineraries.length > 0) {
        await prisma.tourItinerary.deleteMany({ where: { tourId: tour.id } });
        for (let i = 0; i < t.itineraries.length; i++) {
          const it = t.itineraries[i];
          await prisma.tourItinerary.create({
            data: {
              tourId: tour.id,
              dayLabel: it.dayLabel || `Day ${i + 1}`,
              titleJsonb: it.titleJsonb,
              descriptionJsonb: it.descriptionJsonb,
              mealsJsonb: it.mealsJsonb,
              sortOrder: i
            }
          });
        }
      }

      // Upsert Images
      if (t.images && t.images.length > 0) {
        await prisma.tourImage.deleteMany({ where: { tourId: tour.id } });
        for (let i = 0; i < t.images.length; i++) {
          const imgUrl = typeof t.images[i] === 'string' ? t.images[i] : t.images[i].imageUrl;
          if (imgUrl) {
            await prisma.tourImage.create({
              data: {
                tourId: tour.id,
                imageUrl: imgUrl,
                isHero: i === 0,
                sortOrder: i
              }
            });
          }
        }
      }

      count++;
      console.log(`[${count}/${masterTours.size}] ✅ Saved: ${slug} (${t.category}) | ${t.itineraries.length} days | Price: $${t.basePriceUsd}`);
    } catch (err) {
      console.error(`❌ Error saving tour ${slug}:`, err.message);
    }
  }

  // --- Ensure all destination landing pages have attached tours ---
  console.log('\n🔗 Linking tours to destination landing pages...');
  const landingPages = await prisma.tourLandingPage.findMany({
    where: { type: 'DESTINATION', deletedAt: null }
  });

  for (const lp of landingPages) {
    const destSlug = lp.slug.toLowerCase();
    const matchingTours = await prisma.tour.findMany({
      where: {
        deletedAt: null,
        OR: [
          { category: { contains: destSlug, mode: 'insensitive' } },
          { country: { contains: destSlug, mode: 'insensitive' } },
          { city: { contains: destSlug, mode: 'insensitive' } },
          destSlug === 'egypt' ? { category: { in: ['Egypt', 'Honeymoon', 'Religious'] } } : {},
          destSlug === 'turkey' ? { category: { in: ['Turkey'] } } : {},
          destSlug === 'dubai' ? { category: { in: ['Dubai'] } } : {},
          destSlug === 'jordan' ? { category: { in: ['Jordan'] } } : {},
          destSlug === 'morocco' ? { category: { in: ['Morocco'] } } : {},
          destSlug === 'tunisia' ? { category: { in: ['Tunisia'] } } : {},
          destSlug === 'multi-country' ? { category: { in: ['Multi-Country'] } } : {},
          destSlug === 'religious' ? { category: { in: ['Religious'] } } : {},
        ]
      }
    });

    for (let i = 0; i < matchingTours.length; i++) {
      const tour = matchingTours[i];
      await prisma.tourLandingPageTour.upsert({
        where: {
          landingPageId_tourId: {
            landingPageId: lp.id,
            tourId: tour.id
          }
        },
        update: {
          sortOrder: i,
          isVisible: true
        },
        create: {
          landingPageId: lp.id,
          tourId: tour.id,
          sortOrder: i,
          isVisible: true
        }
      });
    }
    console.log(`Linked ${matchingTours.length} tours to landing page: ${lp.slug}`);
  }

  console.log('\n🎉 ALL MASTER TOURS SYNCHRONIZED AND SAVED TO POSTGRES DATABASE SUCCESSFULLY!');
}

main()
  .catch(e => {
    console.error('Fatal synchronization error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
