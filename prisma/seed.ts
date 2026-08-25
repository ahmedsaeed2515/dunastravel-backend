import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';
import { seedMediaAssets } from './seeds/media.seed';
import * as bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required for an explicitly authorized development seed.');
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['info', 'warn', 'error'],
});

// ─── Type Definitions ─────────────────────────────────────────

interface RawProgram {
  slug?: string;
  id?: string | number;
  title?: string | Record<string, string>;
  name?: string | Record<string, string>;
  category?: string;
  type?: string;
  price?: string | number;
  basePriceUsd?: string | number;
  basePrice?: string | number;
  duration?: string | Record<string, string>;
  overview?: string | Record<string, string>;
  description?: string | Record<string, string>;
  images?: string[];
  gallery?: string[];
  heroImage?: string;
  image?: string;
  itinerary?: RawItineraryDay[];
  days?: RawItineraryDay[];
}

interface RawItineraryDay {
  day?: string | number;
  dayLabel?: string;
  title?: string | Record<string, string>;
  description?: string | Record<string, string>;
  meals?: string | Record<string, string>;
}

// ─── Helpers ──────────────────────────────────────────────────

function toMultilingual(
  value: string | Record<string, string> | undefined,
  fallback = '',
): Record<string, string> {
  if (!value) return { en: fallback, es: fallback, ar: fallback };
  if (typeof value === 'string') {
    return { en: value, es: value, ar: value };
  }
  return value;
}

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractSlug(program: RawProgram): string {
  if (program.slug) return program.slug;

  const titleSource =
    typeof program.title === 'string'
      ? program.title
      : typeof program.title === 'object'
        ? (program.title['en'] ?? Object.values(program.title)[0])
        : typeof program.name === 'string'
          ? program.name
          : typeof program.name === 'object'
            ? (program.name['en'] ?? Object.values(program.name)[0])
            : String(program.id ?? 'tour');

  return toSlug(titleSource);
}

function extractPrice(program: RawProgram): number {
  const raw = program.basePriceUsd ?? program.price ?? program.basePrice ?? 999;

  const parsed = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  return isNaN(parsed) ? 999 : parsed;
}

function extractImages(program: RawProgram): string[] {
  if (Array.isArray(program.images) && program.images.length > 0) {
    return program.images;
  }
  if (Array.isArray(program.gallery) && program.gallery.length > 0) {
    return program.gallery;
  }
  const single = program.heroImage ?? program.image;
  return single ? [single] : [];
}

function extractItinerary(program: RawProgram): RawItineraryDay[] {
  if (Array.isArray(program.itinerary)) return program.itinerary;
  if (Array.isArray(program.days)) return program.days;
  return [];
}

// ─── Seeder Functions ─────────────────────────────────────────

async function seedFromJson(programs: RawProgram[]): Promise<void> {
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const program of programs) {
    const slug = extractSlug(program);

    if (!slug) {
      console.warn('  ⚠  Skipping program with no identifiable slug');
      failed++;
      continue;
    }

    const existing = await prisma.tour.findUnique({ where: { slug } });
    if (existing) {
      console.log(`  ↩  Already exists: ${slug}`);
      skipped++;
      continue;
    }

    try {
      const titleSource = program.title ?? program.name;
      const titleJsonb = toMultilingual(
        titleSource as string | Record<string, string>,
        slug,
      );

      const tour = await prisma.tour.create({
        data: {
          slug,
          titleJsonb,
          category: program.category ?? program.type ?? 'general',
          basePriceUsd: extractPrice(program),
          durationJsonb: toMultilingual(
            program.duration as string | Record<string, string>,
          ),
          overviewJsonb: toMultilingual(
            (program.overview ?? program.description) as
              string | Record<string, string>,
          ),
          isActive: true,
        },
      });

      // Seed itinerary days
      const itinerary = extractItinerary(program);
      for (let i = 0; i < itinerary.length; i++) {
        const day = itinerary[i];
        await prisma.tourItinerary.create({
          data: {
            tourId: tour.id,
            dayLabel:
              day.dayLabel ??
              (day.day !== undefined ? `Day ${day.day}` : `Day ${i + 1}`),
            descriptionJsonb: toMultilingual(
              (day.description ?? day.title) as string | Record<string, string>,
            ),
            mealsJsonb: day.meals
              ? toMultilingual(day.meals as string | Record<string, string>)
              : undefined,
            sortOrder: i,
          },
        });
      }

      // Seed images
      const images = extractImages(program);
      for (let i = 0; i < images.length; i++) {
        await prisma.tourImage.create({
          data: {
            tourId: tour.id,
            imageUrl: images[i],
            isHero: i === 0,
            sortOrder: i,
          },
        });
      }

      console.log(
        `  ✅ Seeded: ${slug} | $${extractPrice(program)} | ${itinerary.length} days | ${images.length} images`,
      );
      created++;
    } catch (error) {
      console.error(`  ❌ Failed to seed: ${slug}`, error);
      failed++;
    }
  }

  console.log(`\n📊 Seed Summary:`);
  console.log(`   Created : ${created}`);
  console.log(`   Skipped : ${skipped}`);
  console.log(`   Failed  : ${failed}`);
}

async function seedFallbackTours(): Promise<void> {
  console.log('📌 Seeding fallback sample tours...');

  const fallbackTours = [
{
      slug: 'tunisia-8-days-desert-sea',
      code: 'tunisia-8d-7n-tour',
      titleJsonb: {
        "ar": "برنامج تونس الخضراء المتميز",
        "en": "Premium Green Tunisia Tour - 8 Days / 7 Nights",
        "es": "Circuito Túnez Verde Premium - 8 Días / 7 Noches",
        "it": "Tour Tunisia Verde Premium - 8 Giorni / 7 Notti",
        "pt": "Circuito Tunísia Verde Premium - 8 Dias / 7 Noites"
},
      category: 'Tunisia',
      country: 'Tunisia',
      city: 'Tunis',
      basePriceUsd: 1328,
      durationJsonb: {
        "ar": "8 أيام / 7 ليالي",
        "en": "8 Days / 7 Nights",
        "es": "8 Días / 7 Noches",
        "it": "8 Giorni / 7 Notti",
        "pt": "8 Dias / 7 Noites"
},
      minPaxJsonb: {
        "ar": "فردان",
        "en": "2 Pax",
        "es": "2 Pax",
        "it": "2 Pax",
        "pt": "2 Pax"
},
      overviewJsonb: {
        "ar": "انطلق في رحلة ساحرة عبر الزمن تجمع بين عبق التاريخ الروماني والإسلامي العريق وسحر الطبيعة الصحراوية الفريدة. يمنحك هذا البرنامج المتكامل فرصة استكشاف تونس الخضراء من عاصمتها النابضة بالحياة وصولاً إلى بوابات الصحراء الشاسعة، مع الاستمتاع بإقامة فاخرة وخدمات متكاملة تناسب الأفراد والمجموعات.",
        "en": "Embark on an extraordinary 8-day journey combining ancient Roman splendor, rich Islamic heritage, and the breathtaking beauty of the Sahara Desert. This curated program takes you from the vibrant capital of Tunis to the vast golden dunes of the south, offering a premium experience designed for all travel groups.",
        "es": "Embárquese en un viaje extraordinario de 8 días que combina a la perfección la grandeza romana antigua, el rico legado islámico y la belleza sobrecogedora del desierto del Sahara. Este programa seleccionado le llevará desde la vibrante capital de Túnez hasta las vastas dunas doradas del sur, ofreciendo una experiencia prémium diseñada para todo tipo de grupos.",
        "it": "Imbarcatevi in un viaggio straordinario di 8 giorni che unisce perfettamente l'antica grandezza romana, il ricco patrimonio islamico e la straordinaria bellezza del deserto del Sahara. Questo programma curato vi condurrà dalla vivace capitale Tunisi fino alle vaste dune dorate del sud, offrendo un'esperienza premium pensata per ogni tipo di gruppo.",
        "pt": "Embarque em uma viagem extraordinária de 8 dias que combina perfeitamente a grandeza romana antiga, a rica herança islâmica e a beleza deslumbrante do deserto do Saara. Este programa selecionado levará você da vibrante capital de Túnis às vastas dunas douradas do sul, oferecendo uma experiência premium projetada para todos os tipos de grupos."
},
      includedServicesJsonb: {
        "ar": [
                "تذاكر الطيران (تشمل حقيبة شحن 23 كجم + حقيبة يد كابينة 8 كجم)",
                "الاستقبال والتوصيل من وإلى المطار",
                "الجولات البرية طوال الـ 8 أيام بسيارة سياحية مريحة",
                "مرشد سياحي محترف يتحدث اللغتين الإسبانية/القشتالية",
                "الإقامة 7 ليالٍ في الفنادق المذكورة (4 و 5 نجوم)",
                "7 فطور، 6 غداء، 6 عشاء",
                "رسوم تذاكر دخول المعالم السياحية التالية: (قصر الجم، معالم القيروان، قرطاج، سبيطلة، دقة، ومتحف دار شريط في توزر)",
                "تغطية الزيارات للمدن والقرى المدرجة بالبرنامج",
                "تأمين السفر الأساسي"
        ],
        "en": [
                "Flights with 23kg checked bag + 8kg cabin bag",
                "Airport transfers",
                "8-day tour in a comfortable tourist vehicle",
                "Professional Spanish-speaking guide",
                "7 nights accommodation in 4*/5* hotels",
                "7 breakfasts, 6 lunches, 6 dinners",
                "Entrance fees to monuments (El Jem, Kairouan, Carthage, Sbeitla, Dougga, Dar Chraiet)",
                "Visits to mentioned towns",
                "Basic travel insurance"
        ],
        "es": [
                "Vuelos con maleta facturada de 23 kg + 1 de cabina de 8 kg",
                "Asistencia y traslados",
                "Circuito de 8 días en transporte turístico confortable",
                "Guía profesional en castellano",
                "Alojamiento de 7 noches en hoteles de 4* y 5*",
                "7 desayunos, 6 almuerzos, 6 cenas",
                "Entradas a los monumentos mencionados",
                "Visitas guiadas",
                "Seguro de inclusión"
        ],
        "it": [
                "Voli inclusi con bagaglio da stiva da 23 kg + 1 bagaglio a mano da 8 kg",
                "Assistenza e trasferimenti",
                "Tour di 8 giorni in un veicolo turistico confortevole",
                "Guida professionale in lingua spagnola",
                "Sistemazione per 7 notti in hotel 4*/5*",
                "7 colazioni, 6 pranzi, 6 cene",
                "Ingressi ai monumenti menzionati",
                "Visite guidate",
                "Assicurazione base"
        ],
        "pt": [
                "Voos incluídos com mala despachada de 23 kg + 1 mala de cabine de 8 kg",
                "Assistência e translados",
                "Circuito de 8 dias em transporte turístico confortável",
                "Guia profissional em espanhol",
                "Acomodação de 7 noites em hotéis de 4* e 5*",
                "7 cafés da manhã, 6 almoços, 6 jantares",
                "Ingressos para os monumentos mencionados",
                "Visitas guiadas",
                "Seguro de viagem incluído"
        ]
},
      excludedServicesJsonb: {
        "ar": [
                "الإكراميات (Propinas)",
                "المشروبات مع الوجبات",
                "ضريبة الإقامة الفندقية (Tasa de estancia)"
        ],
        "en": [
                "Tips",
                "Drinks",
                "Hotel city tax"
        ],
        "es": [
                "Propinas",
                "Bebidas",
                "Tasa de estancia hotelera"
        ],
        "it": [
                "Mance",
                "Bevande",
                "Tassa di soggiorno alberghiera"
        ],
        "pt": [
                "Gorjetas",
                "Bebidas",
                "Taxa de estadia em hotéis"
        ]
},
      itineraries: [
        {
                "dayLabel": "Day 1",
                "titleJsonb": {
                        "ar": "اليوم الأول: تونس العاصمة",
                        "en": "DAY 1: TUNIS",
                        "es": "DÍA 1: TÚNEZ",
                        "it": "GIORNO 1: TUNISI",
                        "pt": "DIA 1: TÚNIS"
                },
                "descriptionJsonb": {
                        "ar": "الاستقبال في المطار والانتقال إلى فندق 4 نجوم. (المبيت في تونس).",
                        "en": "Assistance and transfer to a 4* Hotel. Accommodation.",
                        "es": "Asistencia y traslado al Hotel 4*. Alojamiento.",
                        "it": "Assistenza e trasferimento all'Hotel 4*. Pernottamento.",
                        "pt": "Assistência e translado para o Hotel 4*. Acomodação."
                },
                "mealsJsonb": {
                        "ar": "لا يوجد وجبات",
                        "en": "None",
                        "es": "Ninguna",
                        "it": "Nessuno",
                        "pt": "Nenhuma"
                },
                "sortOrder": 0
        },
        {
                "dayLabel": "Day 2",
                "titleJsonb": {
                        "ar": "اليوم الثاني: تونس - المدينة العتيقة - قرطاج - سيدي بوسعيد - الحمامات",
                        "en": "DAY 2: TUNIS - MEDINA - CARTHAGE - SIDI BOU SAID - HAMMAMET",
                        "es": "DÍA 2: TÚNEZ - MEDINA - CARTAGO - SIDI BOU SAID - HAMMAMET",
                        "it": "GIORNO 2: TUNISI - MEDINA - CARTAGINE - SIDI BOU SAID - HAMMAMET",
                        "pt": "DIA 2: TÚNIS - MEDINA - CARTAGO - SIDI BOU SAID - HAMMAMET"
                },
                "descriptionJsonb": {
                        "ar": "الأنشطة: زيارة المدينة العتيقة (المصنفة يونسكو) والتجول في أسواقها الحرفية. ثم التوجه إلى قرطاج وزيارة حمامات أنطونيوس على البحر. الانتقال إلى قرية سيدي بوسعيد والتجول في شوارعها.",
                        "en": "Activities: Departure to the Medina of Tunis (UNESCO World Heritage Site). Walk through the traditional guild-organized souks. Lunch. Departure to Carthage, ancient capital of the Carthaginian empire. Visit the Baths of Antoninus facing the Mediterranean Sea. Continue to the Moorish village of Sidi Bou Said for a walk. Departure to Hammamet. Arrival at 5* Hotel. Dinner and accommodation.",
                        "es": "Actividades: Salida hacia la medina de Túnez (Patrimonio de la Humanidad por la UNESCO). Caminaremos por los zocos organizados de forma gremial. Almuerzo. Salida hacia Cartago, antigua capital del imperio cartaginés. Visita de las termas de Antonino frente al mar Mediterráneo. Continuación hacia el pueblo morisco de Sidi Bou Said y paseo por sus calles. Salida hacia Hammamet. Llegada al Hotel 5*. Cena y alojamiento.",
                        "it": "Attività: Partenza per la Medina di Tunisi (Patrimonio dell'Umanità UNESCO). Passeggiata tra i souk tradizionali organizzati in corporazioni. Pranzo. Partenza per Cartagine, antica capitale dell'impero cartaginese. Visita alle Terme di Antonino di fronte al Mar Mediterraneo. Proseguimento per il villaggio moresco di Sidi Bou Said e passeggiata. Partenza per Hammamet. Arrivo in Hotel 5*. Cena e pernottamento.",
                        "pt": "Atividades: Partida para a Medina de Túnis (Patrimônio Mundial da UNESCO). Caminhada pelos souks tradicionais organizados por corporações de ofício. Almoço. Partida para Cartago, antiga capital do império cartaginês. Visita às Termas de Antonino em frente ao Mar Mediterrâneo. Continuação para a vila mourisca de Sidi Bou Said e passeio pelas suas ruas. Partida para Hammamet. Chegada ao Hotel 5*. Jantar e acomodação."
                },
                "mealsJsonb": {
                        "ar": "فطور + غداء + عشاء",
                        "en": "Breakfast + Lunch + Dinner",
                        "es": "Desayuno + Almuerzo + Cena",
                        "it": "Colazione + Pranzo + Cena",
                        "pt": "Café da manhã + Almoço + Jantar"
                },
                "sortOrder": 1
        },
        {
                "dayLabel": "Day 3",
                "titleJsonb": {
                        "ar": "اليوم الثالث: الحمامات - تستور - دقة (Dougga) - الحمامات",
                        "en": "DAY 3: HAMMAMET - TESTOUR - DOUGGA - HAMMAMET",
                        "es": "DÍA 3: HAMMAMET - TESTOUR - DOUGGA - HAMMAMET",
                        "it": "GIORNO 3: HAMMAMET - TESTOUR - DOUGGA - HAMMAMET",
                        "pt": "DIA 3: HAMMAMET - TESTOUR - DOUGGA - HAMMAMET"
                },
                "descriptionJsonb": {
                        "ar": "الأنشطة: زيارة بلدة 'تستور' الأندلسية، ثم التوجه إلى آثار 'دقة' الرومانية (المصنفة يونسكو) وزيارة المسرح، كنيسة النصر، الحمامات، والمقابر الرومانية (المرتبطة بتاريخ القديس أغسطينوس).",
                        "en": "Activities: Departure to the Ruins of Thugga (modern-day Dougga). Stop in Testour to walk through this medieval village founded by Andalusian Moriscos in the 16th century. Continue to Dougga to visit the most important Roman ruins in Africa (UNESCO World Heritage). Visit the theater, the Church of Victoria, the baths, houses, and temples. Lunch and return to Hammamet. Arrival at 5* Hotel. Dinner and accommodation.",
                        "es": "Actividades: Salida hacia las Ruinas de Thugga (la actual Dougga). Parada en Testur para pasear por este pueblo medieval fundado por los primeros mudéjares en el siglo XVI. Continuación hacia Dougga, donde visitaremos las ruinas más importantes de África (Patrimonio de la Humanidad). Visita del teatro, la iglesia de la Victoria, las termas, las casas y los templos. Almuerzo y regreso a Hammamet. Llegada al Hotel 5*. Cena y alojamiento.",
                        "it": "Attività: Partenza per le Rovine di Thugga (l'attuale Dougga). Sosta a Testour per una passeggiata in questo villaggio medievale fondato dai moriscos andalusi nel XVI secolo. Proseguimento per Dougga, dove visiteremo le ruine romane più importanti d'Africa (Patrimonio UNESCO). Visita del teatro, della Chiesa della Vittoria, delle terme, delle case e dei templi. Pranzo e rientro a Hammamet. Arrivo in Hotel 5*. Cena e pernottamento.",
                        "pt": "Atividades: Partida para as Ruínas de Thugga (atual Dougga). Parada em Testour para caminhar por esta vila medieval fundada pelos mouriscos andaluzes no século XVI. Continuação para Dougga, onde visitaremos as ruínas romanas mais importantes da África (Patrimônio Mundial). Visita ao teatro, à Igreja da Vitória, às termas, às casas e aos templos. Almoço e retorno para Hammamet. Chegada ao Hotel 5*. Jantar e acomodação."
                },
                "mealsJsonb": {
                        "ar": "فطور + غداء + عشاء",
                        "en": "Breakfast + Lunch + Dinner",
                        "es": "Desayuno + Almuerzo + Cena",
                        "it": "Colazione + Pranzo + Cena",
                        "pt": "Café da manhã + Almoço + Jantar"
                },
                "sortOrder": 2
        },
        {
                "dayLabel": "Day 4",
                "titleJsonb": {
                        "ar": "اليوم الرابع: الحمامات - الجم - مطماطة - دوز",
                        "en": "DAY 4: HAMMAMET - EL JEM - MATMATA - DOUZ",
                        "es": "DÍA 4: HAMMAMET - EL JEM - MATMATA - DOUZ",
                        "it": "GIORNO 4: HAMMAMET - EL JEM - MATMATA - DOUZ",
                        "pt": "DIA 4: HAMMAMET - EL JEM - MATMATA - DOUZ"
                },
                "descriptionJsonb": {
                        "ar": "الأنشطة: زيارة قصر الجم (المسرح الروماني الثالث عالمياً). التحرك نحو 'مطماطة' لرؤية البيوت البربرية المحفورة تحت الأرض (موقع تصوير فيلم Star Wars). المرور ببلدة 'تامرزت' البانورامية. الوصول إلى 'دوز' (بوابة الصحراء) لعمل جولة على ركوب الجمال في الكثبان الرملية.",
                        "en": "Activities: Departure to El Jem to visit the Roman amphitheater (3rd largest in the world). Continue to Matmata, the Berber stronghold in the Dahir mountains, famous for its unique underground Troglodyte houses (where Star Wars exterior scenes were filmed). Panoramic stop and lunch in Tamerzet. Continue to Douz, the gateway to the desert. Camel trekking excursion in the dunes. Arrival at 4* Hotel. Dinner and accommodation.",
                        "es": "Actividades: Salida hacia El Jem, visita del anfiteatro romano (el tercero del mundo). Continuación hacia Matmata, bastión de los pueblos bereberes en la cadena de Dahir, con sus famosas casas trogloditas donde se rodó la Guerra de las Galaxias. Parada panorámica y almuerzo en Tamerzet. Continuación hacia Douz, la puerta del desierto. Excursión a lomo de dromedario en las dunas. Regreso al Hotel 4*. Cena y alojamiento.",
                        "it": "Attività: Partenza per El Jem, visita dell'anfiteatro romano (il terzo più grande al mondo). Proseguimento per Matmata, l'ultimo bastione berbero sulle montagne del Dahir, famoso per le case troglodite sotterranee (set di Star Wars). Sosta panoramica e pranzo a Tamerzet. Proseguimento per Douz, la porta del deserto. Escursione a dorso di dromedario tra le dune di sabbia. Arrivo in Hotel 4*. Cena e pernottamento.",
                        "pt": "Atividades: Partida para El Jem, visita ao anfiteatro romano (o terceiro maior do mundo). Continuação para Matmata, o último reduto dos povos berberes nas montanhas de Dahir, famoso por suas casas trogloditas subterrâneas (onde foram filmadas cenas de Star Wars). Parada panorâmica e almoço em Tamerzet. Continuação para Douz, a porta do deserto. Excursão a camelo nas dunas de areia. Chegada ao Hotel 4*. Jantar e acomodação."
                },
                "mealsJsonb": {
                        "ar": "فطور + غداء + عشاء",
                        "en": "Breakfast + Lunch + Dinner",
                        "es": "Desayuno + Almuerzo + Cena",
                        "it": "Colazione + Pranzo + Cena",
                        "pt": "Café da manhã + Almoço + Jantar"
                },
                "sortOrder": 3
        },
        {
                "dayLabel": "Day 5",
                "titleJsonb": {
                        "ar": "اليوم الخامس: دوز - شط الجريد - توزر",
                        "en": "DAY 5: DOUZ - CHOTT EL JERID - TOZEUR",
                        "es": "DÍA 5: DOUZ - CHOTT EL JERID - TOZEUR",
                        "it": "DOUS - CHOTT EL JERID - TOZEUR",
                        "pt": "DIA 5: DOUZ - CHOTT EL JERID - TOZEUR"
                },
                "descriptionJsonb": {
                        "ar": "الأنشطة: عبور بحيرة الملح الجافة 'شط الجريد' بالسيارة ومشاهدة ظاهرة السراب وتغير ألوان المياه. الوصول إلى توزر وزيارة متحف 'دار شريط' ومتحف التمور.",
                        "en": "Activities: Cross the Chott el Jerid salt lake by road, witnessing the shifting water colors and mirages. Continue to Tozeur. Arrival and check-in at 4* Hotel. Lunch. In the afternoon, visit the Dar Chraiet Museum and the Date Museum. Dinner and accommodation.",
                        "es": "Actividades: Salida hacia el desierto cruzando por carretera el lago salado Chott el Jerid, observando los distintos colores de sus aguas y el espejismo. Continuación hacia Tozeur. Llegada y alojamiento en Hotel 4*. Almuerzo. Por la tarde, visita del museo de Dar Chraiet y el Museo de los Dátiles. Cena y alojamiento.",
                        "it": "Attività: Partenza per il deserto attraversando il lago salato Chott el Jerid, ammirando i colori cangianti dell'acqua e i miraggi. Proseguimento per Tozeur. Arrivo e sistemazione in Hotel 4*. Pranzo. Nel pomeriggio, visita del Museo Dar Chraiet e del Museo dei Datteri. Cena e pernottamento.",
                        "pt": "Atividades: Partida em direção ao deserto atravessando o lago salgado Chott el Jerid por estrada, observando as cores mutáveis da água e as miragens. Continuação para Tozeur. Chegada e acomodação em Hotel 4*. Almoço. À tarde, visita ao Museu Dar Chraiet e ao Museu das Tâmaras. Jantar e acomodação."
                },
                "mealsJsonb": {
                        "ar": "فطور + غداء + عشاء",
                        "en": "Breakfast + Lunch + Dinner",
                        "es": "Desayuno + Almuerzo + Cena",
                        "it": "Colazione + Pranzo + Cena",
                        "pt": "Café da manhã + Almoço + Jantar"
                },
                "sortOrder": 4
        },
        {
                "dayLabel": "Day 6",
                "titleJsonb": {
                        "ar": "اليوم السادس: توزر",
                        "en": "DAY 6: TOZEUR",
                        "es": "DÍA 6: TOZEUR",
                        "it": "GIORNO 6: TOZEUR",
                        "pt": "DIA 6: TOZEUR"
                },
                "descriptionJsonb": {
                        "ar": "الأنشطة: جولة صباحية في المدينة القديمة وسوق توزر. فترة بعد الظهر حرة، مع إمكانية عمل (رحلة اختيارية بسيارات 4x4) إلى الواحات الجبلية (شبيكة وتمغزة) ومواقع تصوير الأفلام (The English Patient & Star Wars) في 'عنق الجمل'.",
                        "en": "Activities: Morning visit to the old city and the Souk of Tozeur. Lunch at the hotel. Afternoon at leisure or optional 4x4 excursion to the mountain oases of Chebika, Tamerza, and the desert dunes of Ong Jmel (filming site of The English Patient and Star Wars). Dinner and accommodation at 4* Hotel.",
                        "es": "Actividades: Por la mañana, visita de la ciudad antigua y el Souk de Tozeur. Almuerzo en el hotel. Por la tarde, posibilidad de realizar una excursión opcional en 4x4 a los oasis de montaña (Chebika, Tamerza) y a las pistas de ONG Jmel (El paciente inglés y La guerra de las galaxias). Regreso al Hotel 4*. Cena y alojamiento.",
                        "it": "Attività: Mattinata dedicata alla visita della città vecchia e del Souk di Tozeur. Pranzo in hotel. Pomeriggio libero o escursione facoltativa in 4x4 alle oasi di montagna (Chebika, Tamerza) e alle dune di Ong Jmel (set di Il Paziente Inglese e Star Wars). Cena e pernottamento in Hotel 4*.",
                        "pt": "Atividades: Pela manhã, visita à cidade antiga e ao Souk de Tozeur. Almoço no hotel. À tarde, possibilidade de realizar uma excursão opcional em 4x4 aos oásis de montanha (Chebika, Tamerza) e às pistas de Ong Jmel (cenário de O Paciente Inglês e Star Wars). Retorno ao Hotel 4*. Jantar e acomodação."
                },
                "mealsJsonb": {
                        "ar": "فطور + غداء + عشاء",
                        "en": "Breakfast + Lunch + Dinner",
                        "es": "Desayuno + Almuerzo + Cena",
                        "it": "Colazione + Pranzo + Cena",
                        "pt": "Café da manhã + Almoço + Jantar"
                },
                "sortOrder": 5
        },
        {
                "dayLabel": "Day 7",
                "titleJsonb": {
                        "ar": "اليوم السابع: توزر - القيروان - الحمامات",
                        "en": "DAY 7: TOZEUR - KAIROUAN - HAMMAMET",
                        "es": "DÍA 7: TOZEUR - KAIROUAN - HAMMAMET",
                        "it": "GIORNO 7: TOZEUR - KAIROUAN - HAMMAMET",
                        "pt": "DIA 7: TOZEUR - KAIROUAN - HAMMAMET"
                },
                "descriptionJsonb": {
                        "ar": "الأنشطة: التوجه إلى القيروان وزيارة جامع عقبة بن نافع الكبير ومقام أبي زمعة البلوي (مقام الصحابي/الحلاق). جولة في المدينة العتيقة ثم الانتقال إلى الحمامات.",
                        "en": "Activities: Departure to Kairouan. Visit the Great Mosque of Sidi Oqba and the Mausoleum of the Barber (Sidi Sahbi). Lunch. Walk through the ancient medina and departure to Hammamet. Arrival at 5* Hotel. Dinner and accommodation.",
                        "es": "Actividades: Salida hacia Kairouan. Llegada y visita de la Gran Mezquita de Sidi Oqba y del mausoleo del barbero (Sidi Sahbi). Almuerzo. Paseo por su medina antigua y salida hacia Hammamet. Llegada al Hotel 5*. Cena y alojamiento.",
                        "it": "Attività: Partenza per Kairouan. Visita della Grande Moschea di Sidi Oqba e del Mausoleo del Barbiere (Sidi Sahbi). Pranzo. Passeggiata nella medina antica e partenza per Hammamet. Arrivo in Hotel 5*. Cena e pernottamento.",
                        "pt": "Atividades: Partida para Kairouan. Chegada e visita à Grande Mesquita de Sidi Oqba e ao Mausoléu do Barbeiro (Sidi Sahbi). Almoço. Passeio pela medina antiga e partida para Hammamet. Chegada ao Hotel 5*. Jantar e acomodação."
                },
                "mealsJsonb": {
                        "ar": "فطور + غداء + عشاء",
                        "en": "Breakfast + Lunch + Dinner",
                        "es": "Desayuno + Almuerzo + Cena",
                        "it": "Colazione + Pranzo + Cena",
                        "pt": "Café da manhã + Almoço + Jantar"
                },
                "sortOrder": 6
        },
        {
                "dayLabel": "Day 8",
                "titleJsonb": {
                        "ar": "اليوم الثامن: الحمامات - تونس العاصمة",
                        "en": "DAY 8: HAMMAMET - TUNIS",
                        "es": "DÍA 8: HAMMAMET - TÚNEZ",
                        "it": "GIORNO 8: HAMMAMET - TUNISI",
                        "pt": "DIA 8: HAMMAMET - TÚNIS"
                },
                "descriptionJsonb": {
                        "ar": "الأنشطة: وقت حر حتى موعد التحرك، ثم الانتقال إلى مطار تونس للمغادرة والعودة.",
                        "en": "Activities: Free time until the scheduled transfer to Tunis airport for check-in and departure flight.",
                        "es": "Actividades: Tiempo libre hasta la hora prevista, traslado al aeropuerto de Túnez para trámites de facturación y embarque.",
                        "it": "Attività: Tempo libero fino al trasferimento programmato all'aeroporto di Tunisi per il volo di ritorno.",
                        "pt": "Atividades: Tempo livre até o horário programado, translado para o aeroporto de Túnis para os procedimentos de check-in e embarque."
                },
                "mealsJsonb": {
                        "ar": "فطور",
                        "en": "Breakfast",
                        "es": "Desayuno",
                        "it": "Colazione",
                        "pt": "Café da manhã"
                },
                "sortOrder": 7
        }
],
      images: [
        'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1920&q=80',
        'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=1920&q=80',
        'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1920&q=80',
        'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=1920&q=80'
      ]
    },{
      slug: 'lo-mejor-de-grecia-9d',
      code: 'gr-es-001',
      titleJsonb: {
        ar: 'الأفضل في اليونان – 09 أيام',
        en: 'Best of Greece – 09 Days',
        es: 'Lo Mejor de Grecia – 09 Días',
        it: 'Il Meglio della Grecia – 09 Giorni',
        pt: 'O Melhor da Grécia – 09 Dias',
      },
      category: 'Greece',
      country: 'Greece',
      city: 'Athens',
      basePriceUsd: 1490,
      durationJsonb: {
        ar: '09 أيام / 08 ليالٍ',
        en: '09 Days / 08 Nights',
        es: '09 Días / 08 Noches',
        it: '09 Giorni / 08 Notti',
        pt: '09 Dias / 08 Noites',
      },
      minPaxJsonb: {
        ar: 'فردان',
        en: '2 Pax',
        es: '2 Pax',
        it: '2 Pax',
        pt: '2 Pax',
      },
      overviewJsonb: {
        ar: 'انغمس في روعة اليونان القديمة وسحر البحر إيجة في هذا المسار الرائع الممتد لتسعة أيام. من الأكروبوليس في أثينا إلى غروب الشمس الساحر في سانتوريني وميكونوس، مروراً بطبيعة ومأكولات جزيرة كريت الخلابة وتاريخها المينوي العريق، تدمج هذه الرحلة بين الثقافة الكلاسيكية وروعة البحر الأبيض المتوسط.',
        en: 'Immerse yourself in the splendor of Ancient Greece and the charm of the Aegean Sea on this spectacular nine-day itinerary. From the grand Acropolis of Athens to the vibrant sunsets in Santorini and Mykonos, each stop reveals a piece of paradise and culture. Crowned with authentic gastronomy and Minoan history in Crete, this journey combines classical culture with pure Mediterranean essence.',
        es: 'Sumérgete en el esplendor de la Antigua Grecia y el encanto del mar Egeo en este espectacular itinerario de nueve días. Desde la grandiosa Acrópolis de Atenas hasta los vibrantes atardeceres en Santorini y Mykonos, cada escala revela un pedazo de paraíso y cultura. Coronando la travesía con la auténtica gastronomía e historia minoica en Creta, este viaje combina cultura clásica y pura esencia mediterránea.',
        it: "Immergiti nello splendore dell'Antica Grecia e nel fascino del Mar Egeo in questo spettacolare itinerario di nove giorni. Dalla grandiosa Acropoli di Atene ai vibranti tramonti di Santorini e Mykonos, ogni tappa rivela un pezzo di paradiso e cultura. Coronando il viaggio con l'autentica gastronomia e la storia minoica a Creta, questo viaggio unisce la cultura classica alla pura essenza mediterranea.",
        pt: 'Mergulhe no esplendor da Grécia Antiga e no encanto do Mar Egeu neste espetacular itinerário de nove dias. Da grandiosa Acrópole de Atenas aos vibrantes por do sol em Santorini e Mykonos, cada parada revela um pedaço do paraíso e da cultura. Coroando a viagem com a autêntica gastronomia e história minóica em Creta, esta viagem combina cultura clássica e pura essência mediterrânea.',
      },
      includedServicesJsonb: {
        "ar": [
                "ليلتان في أثينا، ليلتان في ميكونوس، ليلتان في سانتوريني وليلتان في كريت مع الإفطار",
                "جولة سياحية في مدينة أثينا نصف يوم (باص مشترك) مع مرشد محترف يتحدث الإسبانية",
                "جميع وسائل النقل",
                "لقاء مع مساعد يتحدث الإسبانية في يوم الوصول للتوجيه السياحي",
                "تذاكر العبّارة: بيرايوس – ميكونوس (عبّارة عادية بمقاعد مرقّمة)، وميكونوس – سانتوريني // سانتوريني – هيراكليون (عبّارة سريعة – الدرجة الاقتصادية)",
                "تذاكر دخول المتاحف والمواقع الأثرية",
                "جميع الرسوم وخدماتنا (باستثناء ضريبة الإقامة)"
        ],
        "en": [
                "Two nights accommodation in Athens, two in Mykonos, two in Santorini and two in Crete with breakfast",
                "Half-day shared city tour of Athens with a professional Spanish-speaking guide",
                "All transfers",
                "Meet with a Spanish-speaking assistant on arrival day for travel orientation",
                "Ferry tickets: Piraeus – Mykonos (regular ferry, numbered seats), Mykonos – Santorini // Santorini – Heraklion (high-speed ferry, economy class)",
                "Entrance tickets to museums and archaeological sites",
                "All taxes and our services (except city tax)"
        ],
        "es": [
                "Dos noches de alojamiento en Atenas, dos en Mykonos, dos en Santorini y dos en Creta con desayuno",
                "Visita de la ciudad de Atenas regular de medio día con guía profesional de habla hispana",
                "Todos los traslados",
                "Encuentro con asistente de habla hispana al día de llegada por una orientación del viaje",
                "Billetes de ferry Pireo – Mykonos con ferry regular (asientos numerados) y Mykonos – Santorini // Santorini – Heraklion con ferry rápido – clase económica",
                "Las entradas a los museos y sitios arqueológicos",
                "Todas las tasas y nuestros servicios (excepto el impuesto de estancia)"
        ],
        "it": [
                "Due notti di alloggio ad Atene, due a Mykonos, due a Santorini e due a Creta con colazione",
                "Visita guidata di mezza giornata di Atene in pullman con guida professionale di lingua spagnola",
                "Tutti i trasferimenti",
                "Incontro con un assistente di lingua spagnola il giorno dell'arrivo per un orientamento sul viaggio",
                "Biglietti di traghetto: Pireo – Mykonos con traghetto regolare (posti numerati) e Mykonos – Santorini // Santorini – Heraklion con traghetto veloce – classe economica",
                "I biglietti d'ingresso ai musei e siti archeologici",
                "Tutte le tasse e i nostri servizi (esclusa la tassa di soggiorno)"
        ],
        "pt": [
                "Duas noites de hospedagem em Atenas, duas em Mykonos, duas em Santorini e duas em Creta com café da manhã",
                "Visita de meio dia regular pela cidade de Atenas com guia profissional de língua espanhola",
                "Todos os transfers",
                "Encontro com assistente de língua espanhola no dia da chegada para orientação da viagem",
                "Bilhetes de ferry: Pireu – Mykonos em ferry regular (assentos numerados) e Mykonos – Santorini // Santorini – Heráclion em ferry rápido – classe econômica",
                "As entradas para museus e sítios arqueológicos",
                "Todas as taxas e nossos serviços (exceto o imposto de estadia)"
        ]
},
      excludedServicesJsonb: {
        "ar": [
                "الوجبات غير المذكورة",
                "المشروبات أثناء الوجبات المشمولة",
                "المصروفات الشخصية",
                "الإكراميات",
                "خدمة حمل الأمتعة في الفنادق",
                "أي شيء آخر غير مذكور صراحة في التضمينات"
        ],
        "en": [
                "Meals not mentioned",
                "Beverages during included meals",
                "Personal expenses",
                "Tips",
                "Porters at hotels",
                "Anything else not specifically mentioned in the inclusions"
        ],
        "es": [
                "Las comidas que no sean mencionadas",
                "Las bebidas durante las comidas incluidas",
                "Gastos personales",
                "Propinas",
                "Maleteros a los hoteles",
                "Cualquier otra cosa no mencionada específicamente en las inclusiones"
        ],
        "it": [
                "I pasti non menzionati",
                "Le bevande durante i pasti inclusi",
                "Spese personali",
                "Mance",
                "Facchini negli hotel",
                "Qualsiasi altra cosa non menzionata specificatamente nelle inclusioni"
        ],
        "pt": [
                "As refeições não mencionadas",
                "As bebidas durante as refeições incluídas",
                "Gastos pessoais",
                "Gorjetas",
                "Carregadores de bagagem nos hotéis",
                "Qualquer outra coisa não mencionada especificamente nas inclusões"
        ]
},
      itineraries: [
        {
                "dayLabel": "Day 1",
                "titleJsonb": {
                        "ar": "الوصول / أثينا",
                        "en": "Arrival / Athens",
                        "es": "Llegada / Atenas",
                        "it": "Arrivo / Atene",
                        "pt": "Chegada / Atenas"
                },
                "descriptionJsonb": {
                        "ar": "الوصول إلى المطار والالتقاء بمسؤول الاستقبال من الوكالة. النقل إلى الفندق. باقي اليوم حر. الإقامة.",
                        "en": "Arrival at the airport and meet with the agency assistance. Transfer to the hotel. Rest of the day free. Accommodation.",
                        "es": "Llegada al aeropuerto y encuentro con la asistencia de la agencia. Traslado al hotel. Resto del día libre. Alojamiento.",
                        "it": "Arrivo in aeroporto e incontro con l'assistenza dell'agenzia. Trasferimento in hotel. Resto della giornata libero. Sistemazione.",
                        "pt": "Chegada ao aeroporto e encontro com a assistência da agência. Transfer para o hotel. Resto do dia livre. Hospedagem."
                },
                "mealsJsonb": {
                        "ar": "غير مشمول",
                        "en": "Not included",
                        "es": "Sin comidas",
                        "it": "Non incluso",
                        "pt": "Não incluído"
                },
                "sortOrder": 0
        },
        {
                "dayLabel": "Day 2",
                "titleJsonb": {
                        "ar": "جولة في المدينة / أثينا",
                        "en": "City Tour / Athens",
                        "es": "Visita de la ciudad / Atenas",
                        "it": "Visita della città / Atene",
                        "pt": "Visita da cidade / Atenas"
                },
                "descriptionJsonb": {
                        "ar": "إفطار وانطلاق بالحافلة لزيارة أشهر معالم أثينا. خلال الجولة نمر بالبرلمان مع نصب الجندي المجهول، ساحة سينتاغما، الثلاثية الكلاسيكية الجديدة، ساحة أومونيا، مبنى البرلمان الذي يعود للقرن 19، الكاتدرائية الكاثوليكية، معبد زيوس الروماني، قوس هادريان ونتوقف لالتقاط الصور في الملعب الأولمبي الشهير حيث أقيمت أول دورة ألعاب أولمبية حديثة في عام 1896. زيارة الأكروبوليس مع البروبيليا، معبد أثينا نايكي، البارثينون والإرخثيون. وقت حر لاستكشاف البلدة القديمة في بلاكا. الإقامة.",
                        "en": "Breakfast and departure by coach to tour the most famous monuments of Athens. During the tour we pass by the Parliament with the monument of the Unknown Soldier, Syntagma Square, the neoclassical Trilogy, Omonia Square, the 19th-century Parliament building, the Catholic Cathedral, the Roman Temple of Zeus, Hadrian's Arch and stop for photos at the famous Olympic Stadium where the first modern Olympic Games were held in 1896. Visit of the Acropolis with the Propylaea, the Temple of Athena Nike, the Parthenon and the Erechtheion. Free time to explore the old quarter of Plaka. Accommodation.",
                        "es": "Desayuno y salida en autocar para recorrer los monumentos más famosos de Atenas. Durante el recorrido pasamos por el Parlamento con el monumento del Soldado Desconocido, la plaza Sintagma, la Trilogía neoclásica, la plaza Omonia, el Parlamento del siglo 19, la catedral Católica, el templo romano de Zeus, el Arco de Adriano y paramos para sacar fotos al famoso estadio Olímpico donde se celebraron los primeros Juegos Olímpicos modernos en 1896. Visita de la Acrópolis con los Propileos, el templo de Atenea Nike, el Partenón y el Erecteón. Tiempo libre para explorar el casco antiguo de Plaka. Alojamiento.",
                        "it": "Colazione e partenza in pullman per visitare i monumenti più famosi di Atene. Durante il percorso passiamo dal Parlamento con il monumento del Milite Ignoto, piazza Syntagma, la Trilogia neoclassica, piazza Omonia, il Palazzo del Parlamento del XIX secolo, la cattedrale Cattolica, il tempio romano di Zeus, l'Arco di Adriano e ci fermiamo per foto al famoso stadio Olimpico dove si sono svolti i primi Giochi Olimpici moderni nel 1896. Visita dell'Acropoli con i Propilei, il tempio di Atena Nike, il Partenone e l'Eretteo. Tempo libero per esplorare il centro storico di Plaka. Sistemazione.",
                        "pt": "Café da manhã e saída de autocarro para percorrer os monumentos mais famosos de Atenas. Durante o percurso passamos pelo Parlamento com o monumento do Soldado Desconhecido, a praça Syntagma, a Trilogia neoclássica, a praça Omonia, o Parlamento do século XIX, a catedral Católica, o templo romano de Zeus, o Arco de Adriano e paramos para fotos no famoso estádio Olímpico onde se realizaram os primeiros Jogos Olímpicos modernos em 1896. Visita da Acrópole com os Propileus, o templo de Atena Niké, o Partenon e o Erecteion. Tempo livre para explorar o centro histórico de Plaka. Hospedagem."
                },
                "mealsJsonb": {
                        "ar": "إفطار",
                        "en": "Breakfast",
                        "es": "Desayuno",
                        "it": "Colazione",
                        "pt": "Café da manhã"
                },
                "sortOrder": 1
        },
        {
                "dayLabel": "Day 3",
                "titleJsonb": {
                        "ar": "بيرايوس – ميكونوس / ميكونوس",
                        "en": "Piraeus – Mykonos / Mykonos",
                        "es": "Pireo – Mykonos / Mykonos",
                        "it": "Il Pireo – Mykonos / Mykonos",
                        "pt": "Pireu – Mykonos / Mykonos"
                },
                "descriptionJsonb": {
                        "ar": "إفطار ونقل إلى ميناء بيرايوس للصعود على متن العبارة المتجهة إلى ميكونوس. عند الوصول إلى الجزيرة، النقل إلى الفندق وباقي اليوم حر. الإقامة.",
                        "en": "Breakfast and transfer to the port of Piraeus to board the ferry bound for Mykonos. Upon arrival on the island, transfer to the hotel and rest of the day free. Accommodation.",
                        "es": "Desayuno y traslado al puerto del Pireo para embarcar en el ferry con destino a Mykonos. A su llegada a la isla, traslado al hotel y resto del día libre. Alojamiento.",
                        "it": "Colazione e trasferimento al porto del Pireo per imbarcarsi sul traghetto diretto a Mykonos. All'arrivo sull'isola, trasferimento in hotel e resto della giornata libero. Sistemazione.",
                        "pt": "Café da manhã e transfer para o porto do Pireu para embarcar no ferry com destino a Mykonos. À sua chegada à ilha, transfer para o hotel e resto do dia livre. Hospedagem."
                },
                "mealsJsonb": {
                        "ar": "إفطار",
                        "en": "Breakfast",
                        "es": "Desayuno",
                        "it": "Colazione",
                        "pt": "Café da manhã"
                },
                "sortOrder": 2
        },
        {
                "dayLabel": "Day 4",
                "titleJsonb": {
                        "ar": "يوم حر / ميكونوس",
                        "en": "Free Day / Mykonos",
                        "es": "Día libre / Mykonos",
                        "it": "Giorno libero / Mykonos",
                        "pt": "Dia livre / Mykonos"
                },
                "descriptionJsonb": {
                        "ar": "يوم حر في جزيرة ميكونوس الشهيرة، نقطة الالتقاء الدولية لمحبي \"الجيت سيت\". استمتع بالشواطئ الرائعة والمتاجر المبهرة والحياة الليلية التي لا تضاهى. إفطار وإقامة في الفندق.",
                        "en": "Free day on the famous island of Mykonos, the international meeting point of the \"jet set\". Enjoy the wonderful beaches, dazzling shops and incomparable nightlife. Breakfast and accommodation at the hotel.",
                        "es": "Día libre en la famosa isla de Mykonos, el punto internacional del encuentro del \"jet set\". Disfrute las playas maravillosas, tiendas deslumbrantes y la incomparable vida nocturna. Desayuno y alojamiento en el hotel.",
                        "it": "Giorno libero nella famosa isola di Mykonos, il punto d'incontro internazionale del \"jet set\". Godetevi le splendide spiagge, i negozi scintillanti e l'incomparabile vita notturna. Colazione e sistemazione in hotel.",
                        "pt": "Dia livre na famosa ilha de Mykonos, o ponto de encontro internacional do \"jet set\". Desfrute das maravilhosas praias, lojas deslumbrantes e a incomparável vida noturna. Café da manhã e hospedagem no hotel."
                },
                "mealsJsonb": {
                        "ar": "إفطار",
                        "en": "Breakfast",
                        "es": "Desayuno",
                        "it": "Colazione",
                        "pt": "Café da manhã"
                },
                "sortOrder": 3
        },
        {
                "dayLabel": "Day 5",
                "titleJsonb": {
                        "ar": "ميكونوس – سانتوريني / سانتوريني",
                        "en": "Mykonos – Santorini / Santorini",
                        "es": "Mykonos – Santorini / Santorini",
                        "it": "Mykonos – Santorini / Santorini",
                        "pt": "Mykonos – Santorini / Santorini"
                },
                "descriptionJsonb": {
                        "ar": "إفطار وصباح حر حتى موعد النقل إلى ميناء ميكونوس للصعود على متن العبارة المتجهة إلى سانتوريني. عند الوصول إلى الجزيرة، النقل إلى الفندق وباقي اليوم حر. الإقامة.",
                        "en": "Breakfast and free morning until the transfer time to the port of Mykonos to board the ferry bound for Santorini. Upon arrival on the island, transfer to the hotel and rest of the day free. Accommodation.",
                        "es": "Desayuno y mañana libre hasta la hora de traslado al puerto de Mykonos para embarcar en el ferry con destino a Santorini. A su llegada a la isla, traslado al hotel y resto del día libre. Alojamiento.",
                        "it": "Colazione e mattinata libera fino all'orario del trasferimento al porto di Mykonos per imbarcarsi sul traghetto diretto a Santorini. All'arrivo sull'isola, trasferimento in hotel e resto della giornata libero. Sistemazione.",
                        "pt": "Café da manhã e manhã livre até a hora do transfer para o porto de Mykonos para embarcar no ferry com destino a Santorini. À sua chegada à ilha, transfer para o hotel e resto do dia livre. Hospedagem."
                },
                "mealsJsonb": {
                        "ar": "إفطار",
                        "en": "Breakfast",
                        "es": "Desayuno",
                        "it": "Colazione",
                        "pt": "Café da manhã"
                },
                "sortOrder": 4
        },
        {
                "dayLabel": "Day 6",
                "titleJsonb": {
                        "ar": "يوم حر / سانتوريني",
                        "en": "Free Day / Santorini",
                        "es": "Día libre / Santorini",
                        "it": "Giorno libero / Santorini",
                        "pt": "Dia livre / Santorini"
                },
                "descriptionJsonb": {
                        "ar": "يوم حر لاستكشاف جزيرة سانتوريني الساحرة. اكتشف فيرا وأويا مع الإطلالات الخلابة على البركان، واستمتع بواحدة من أفضل غروب الشمس في بحر إيجة. استكشف الشواطئ الفريدة ذات الرمال السوداء أو قم بجولة بحرية إلى جزر الكالديرا.",
                        "en": "Free day to explore the magical island of Santorini. Discover Fira & Oia with the stunning views of the volcano, and enjoy one of the best sunsets in the Aegean Sea. Explore the unique black sand beaches or take a boat tour to the caldera islands.",
                        "es": "Día libre para explorar la isla mágica de Santorini. Descubra Fira & Oia con las impresionantes vistas al volcán, y disfrute de uno de los mejores atardeceres en el mar Egeo. Explora las playas únicas de arena negra o tomar un tour en barco a las islas de la caldera.",
                        "it": "Giorno libero per esplorare la magica isola di Santorini. Scoprite Fira e Oia con le spettacolari viste sul vulcano e godetevi uno dei migliori tramonti del Mar Egeo. Esplorate le uniche spiagge di sabbia nera o fate un giro in barca alle isole della caldera.",
                        "pt": "Dia livre para explorar a mágica ilha de Santorini. Descubra Fira & Oia com as impressionantes vistas para o vulcão, e desfrute de um dos melhores pores do sol no Mar Egeu. Explore as praias únicas de areia preta ou faça um passeio de barco para as ilhas da caldeira."
                },
                "mealsJsonb": {
                        "ar": "إفطار",
                        "en": "Breakfast",
                        "es": "Desayuno",
                        "it": "Colazione",
                        "pt": "Café da manhã"
                },
                "sortOrder": 5
        },
        {
                "dayLabel": "Day 7",
                "titleJsonb": {
                        "ar": "سانتوريني – هيراكليون / كريت",
                        "en": "Santorini – Heraklion / Crete",
                        "es": "Santorini – Heraklion / Creta",
                        "it": "Santorini – Heraklion / Creta",
                        "pt": "Santorini – Heráclion / Creta"
                },
                "descriptionJsonb": {
                        "ar": "إفطار ونقل إلى ميناء سانتوريني للصعود على متن العبارة السريعة المتجهة إلى هيراكليون. عند الوصول إلى الجزيرة، النقل إلى الفندق وباقي اليوم حر. الإقامة.",
                        "en": "Breakfast and transfer to the port of Santorini to board the high-speed ferry bound for Heraklion. Upon arrival on the island, transfer to the hotel and rest of the day free. Accommodation.",
                        "es": "Desayuno y traslado al puerto de Santorini para embarcar en el ferry rápido con destino a Heraklion. A su llegada a la isla, traslado al hotel y resto del día libre. Alojamiento.",
                        "it": "Colazione e trasferimento al porto di Santorini per imbarcarsi sul traghetto veloce diretto a Heraklion. All'arrivo sull'isola, trasferimento in hotel e resto della giornata libero. Sistemazione.",
                        "pt": "Café da manhã e transfer para o porto de Santorini para embarcar no ferry rápido com destino a Heráclion. À sua chegada à ilha, transfer para o hotel e resto do dia livre. Hospedagem."
                },
                "mealsJsonb": {
                        "ar": "إفطار",
                        "en": "Breakfast",
                        "es": "Desayuno",
                        "it": "Colazione",
                        "pt": "Café da manhã"
                },
                "sortOrder": 6
        },
        {
                "dayLabel": "Day 8",
                "titleJsonb": {
                        "ar": "يوم حر / كريت",
                        "en": "Free Day / Crete",
                        "es": "Día libre / Creta",
                        "it": "Giorno libero / Creta",
                        "pt": "Dia livre / Creta"
                },
                "descriptionJsonb": {
                        "ar": "يوم حر لاستكشاف أكبر الجزر اليونانية. تأكد من تذوق الطعام الكريتي الفريد، واستكشاف الحضارة المينوية في كنوسوس، واكتشاف شواطئ إلوندا الجميلة، والاستمتاع برحلة بحرية إلى جزيرة سبينالونغا التاريخية.",
                        "en": "Free day to explore the largest of the Greek islands. Be sure to try the unique Cretan food, explore the Minoan civilization at Knossos, discover the beautiful beaches of Elounda, and enjoy a boat trip to the historic Spinalonga.",
                        "es": "Día libre para explorar el más grande de las islas griegas. Asegúrese de probar la comida cretense única, explorar la civilización minoica en Knossos, descubrir las hermosas playas de Elunda, y disfrutar de un paseo en barco a la histórica Spinalonga.",
                        "it": "Giorno libero per esplorare la più grande delle isole greche. Assicuratevi di assaggiare l'unico cibo cretese, esplorare la civiltà minoica a Cnosso, scoprire le bellissime spiagge di Elounda e godervi un giro in barca alla storica Spinalonga.",
                        "pt": "Dia livre para explorar a maior das ilhas gregas. Certifique-se de provar a comida cretense única, explorar a civilização minoica em Cnossos, descobrir as belas praias de Elounda e desfrutar de um passeio de barco para a histórica Spinalonga."
                },
                "mealsJsonb": {
                        "ar": "إفطار",
                        "en": "Breakfast",
                        "es": "Desayuno",
                        "it": "Colazione",
                        "pt": "Café da manhã"
                },
                "sortOrder": 7
        },
        {
                "dayLabel": "Day 9",
                "titleJsonb": {
                        "ar": "المغادرة",
                        "en": "Departure",
                        "es": "Salida",
                        "it": "Partenza",
                        "pt": "Partida"
                },
                "descriptionJsonb": {
                        "ar": "إفطار وصباح حر حتى موعد النقل إلى المطار لرحلة داخلية قصيرة، مرتبطة برحلة عودتك الدولية.",
                        "en": "Breakfast and free morning until the transfer time to the airport for a short domestic flight, connecting with your international return flight.",
                        "es": "Desayuno y mañana libre hasta la hora de traslado al aeropuerto para un vuelo doméstico corto, conectado con su vuelo de regreso internacional.",
                        "it": "Colazione e mattinata libera fino all'orario del trasferimento in aeroporto per un breve volo domestico, in coincidenza con il vostro volo di ritorno internazionale.",
                        "pt": "Café da manhã e manhã livre até a hora do transfer para o aeroporto para um curto voo doméstico, conectando com seu voo internacional de regresso."
                },
                "mealsJsonb": {
                        "ar": "إفطار",
                        "en": "Breakfast",
                        "es": "Desayuno",
                        "it": "Colazione",
                        "pt": "Café da manhã"
                },
                "sortOrder": 8
        }
],
      images: [
        'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1920&q=80',
        'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?auto=format&fit=crop&w=1920&q=80',
        'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1920&q=80',
        'https://images.unsplash.com/photo-1555993539-1732b0258235?auto=format&fit=crop&w=1920&q=80'
      ]
    },{
      slug: 'mrc-01-spices-of-morocco',
      code: 'MRC-01',
      titleJsonb: {
        ar: 'توابل المغرب',
        en: 'Spices of Morocco',
        es: 'Especias de Marruecos',
        it: 'Spezie del Marocco',
        pt: 'Especiarias de Marrocos',
      },
      category: 'Morocco',
      country: 'Morocco',
      city: 'Marrakech',
      basePriceUsd: 799,
      durationJsonb: {
        ar: '05 أيام / 04 ليالٍ',
        en: '05 Days / 04 Nights',
        es: '05 Días / 04 Noches',
        it: '05 Giorni / 04 Notti',
        pt: '05 Dias / 04 Noites',
      },
      minPaxJsonb: {
        ar: 'فردان',
        en: '2 Pax',
        es: '2 Pax',
        it: '2 Pax',
        pt: '2 Pax',
      },
      highlightsJsonb: {
        ar: [
          'زيارة مدينة مكناس الإمبراطورية',
          'جولة كاملة في فاس العاصمة الدينية',
          'زيارة الرباط والدار البيضاء ومراكش',
          'ساحة جامع الفناء والأسوق التقليدية',
          'عبور البحر الأبيض المتوسط بالعبارة',
        ],
        en: [
          'Visit the imperial city of Meknes',
          'Full tour of Fez, the religious capital',
          'Visit Rabat, Casablanca & Marrakech',
          'Jemaa el Fna square and traditional souks',
          'Mediterranean crossing by ferry',
        ],
        es: [
          'Visita a la ciudad imperial de Meknes',
          'Recorrido completo por Fez, capital religiosa',
          'Visita a Rabat, Casablanca y Marrakech',
          'Plaza Jemaa el Fna y zocos tradicionales',
          'Travesía del Mediterráneo en ferry',
        ],
        it: [
          'Visita alla città imperiale di Meknes',
          'Tour completo di Fez, capitale religiosa',
          'Visita a Rabat, Casablanca e Marrakech',
          'Piazza Jemaa el Fna e souk tradizionali',
          'Attraversamento del Mediterraneo in traghetto',
        ],
        pt: [
          'Visita à cidade imperial de Meknes',
          'Visita completa a Fez, capital religiosa',
          'Visita a Rabat, Casablanca e Marraquexe',
          'Praça Jemaa el Fna e souks tradicionais',
          'Travessia do Mediterrâneo de ferry',
        ],
      },
      pricingJsonb: {
        hotels: [
          { ar: 'فندق 4 نجوم', en: '4 Star Hotel', es: 'Hotel 4 Estrellas', it: 'Hotel 4 Stelle', pt: 'Hotel 4 Estrelas' },
        ],
        winter: [{ dbl: 899, sgl: 350 }],
        summer: [{ dbl: 799, sgl: 280 }],
        winterDates: '01 Oct – 30 Apr',
        summerDates: '01 May – 30 Sep',
      },
      overviewJsonb: {
        ar: 'رحلة 5 أيام لاكتشاف كنوز المغرب: من طنجة إلى مراكش مروراً بفاس والرباط والدار البيضاء. استمتع بالمدن الإمبراطورية والأسواق التقليدية والهندسة المعمارية المغربية الأصيلة.',
        en: 'A 5-day journey to discover the treasures of Morocco: from Tangier to Marrakech via Fez, Rabat and Casablanca. Enjoy imperial cities, traditional souks and authentic Moroccan architecture.',
        es: 'Un viaje de 5 días para descubrir los tesoros de Marruecos: desde Tánger hasta Marrakech pasando por Fez, Rabat y Casablanca. Disfrute de ciudades imperiales, zocos tradicionales y auténtica arquitectura marroquí.',
        it: 'Un viaggio di 5 giorni alla scoperta dei tesori del Marocco: da Tangeri a Marrakech passando per Fez, Rabat e Casablanca. Godetevi città imperiali, souk tradizionali e autentica architettura marocchina.',
        pt: 'Uma viagem de 5 dias para descobrir os tesouros de Marrocos: de Tânger a Marraquexe passando por Fez, Rabat e Casablanca. Desfrute de cidades imperiais, souks tradicionais e autêntica arquitetura marroquina.',
      },
      includedServicesJsonb: {
        ar: [
          'النقل: كوستا ديل سول / طريفة / كوستا ديل سول',
          'تذاكر العبارة: طريفة / طنجة / طريفة',
          'النقل داخل المغرب',
          'مرشد مرافق طوال الجولة في المغرب',
          'إقامة 4 ليالٍ في الفندق بنظام الإقامة الكاملة جزئياً (3 وجبات عشاء + 1 وجبة غداء)',
          'الزيارات المذكورة في البرنامج',
        ],
        en: [
          'Transfers Costa del Sol / Tarifa / Costa del Sol',
          'Ferry tickets Tarifa / Tangier / Tarifa',
          'Transportation in Morocco',
          'Escort guide throughout the tour in Morocco',
          '4 nights hotel on half-board basis (3 dinners + 1 lunch)',
          'Visits mentioned in the program',
        ],
        es: [
          'Traslados Costa del Sol / Tarifa / Costa del Sol',
          'Billetes de ferry Tarifa / Tánger / Tarifa',
          'Transporte en Marruecos',
          'Guía acompañante en el tour en Marruecos',
          '4 noches de hotel en régimen de media pensión (3 cenas + 1 almuerzo)',
          'Visitas mencionadas en el programa',
        ],
        it: [
          'Trasferimenti Costa del Sol / Tarifa / Costa del Sol',
          'Biglietti del traghetto Tarifa / Tangeri / Tarifa',
          'Trasporto in Marocco',
          'Guida accompagnatrice nel tour in Marocco',
          '4 notti in hotel in regime di mezza pensione (3 cene + 1 pranzo)',
          'Visite menzionate nel programma',
        ],
        pt: [
          'Translados Costa del Sol / Tarifa / Costa del Sol',
          'Bilhetes de ferry Tarifa / Tânger / Tarifa',
          'Transporte em Marrocos',
          'Guia acompanhante no tour em Marrocos',
          '4 noites de hotel em regime de meia-pensão (3 jantares + 1 almoço)',
          'Visitas mencionadas no programa',
        ],
      },
      excludedServicesJsonb: {
        ar: ['تأشيرة دخول المغرب', 'إكراميات السفر والمساعدة'],
        en: ['Entry visa to Morocco', 'Travel tips and assistance'],
        es: ['Visado de entrada a Marruecos', 'Propinas de viaje y asistencia'],
        it: ['Visto d\'ingresso in Marocco', 'Mance di viaggio e assistenza'],
        pt: ['Visto de entrada em Marrocos', 'Gorjetas de viagem e assistência'],
      },
      itineraries: [
        {
          dayLabel: 'Day 1',
          descriptionJsonb: {
            ar: 'النقل من نقاط التجمع المختلفة في كوستا ديل سول نحو طريفة. ركوب العبارة من طريفة نحو طنجة. عند الوصول، يكون في الاستقبال مرشدنا المغربي الذي سيرافق الرحلة طوال الجولة. التحرك نحو مدينة مكناس الإمبراطورية، لإجراء جولة بانورامية للمدينة ولأسوار باب المنصور. المتابعة نحو فاس. الوصول في أواخر فترة بعد الظهر. العشاء والإقامة في الفندق.\n\nملاحظة هامة: تخضع مدينة مكناس حالياً لأعمال تجديد، مما يجعل زيارتها أمراً مستحيلاً نظراً للعدد الكبير من الأعمال الهامة التي يتم تنفيذها.',
            en: 'Transfer from the different pick-up points in Costa del Sol towards Tarifa. Boarding the ferry from Tarifa towards Tangier. Upon arrival, our Moroccan guide awaits, who will accompany the group throughout the tour. Departure to the imperial city of Meknes, for a panoramic tour of the city and the walls of Bab el Mansour. Continuation to Fez. Arrival in the late afternoon. Dinner and accommodation at the hotel.\n\nIMPORTANT NOTE: Currently, the city of Meknes is undergoing remodeling, which makes it impossible to visit due to the large number of major works being carried out.',
            es: 'Traslado desde los diferentes puntos de recogida de Costa del Sol hacia Tarifa. Embarque en ferry desde Tarifa hacia Tánger. A la llegada, espera nuestro guía marroquí que acompaña durante todo el recorrido. Salida hacia la ciudad imperial de Meknes, para hacer una visita panorámica de la ciudad y de las murallas de Bab el Mansour. Continuación hacia Fez. Llegada al final de la tarde. Cena y alojamiento en el hotel.\n\nNOTA IMPORTANTE: Actualmente la ciudad de Meknes se encuentra en remodelación, lo que hace que sea imposible poder visitarla debido a la gran cantidad de obras importantes que se están realizando.',
            it: 'Trasferimento dai diversi punti di raccolta della Costa del Sol verso Tarifa. Imbarco sul traghetto da Tarifa verso Tangeri. All\'arrivo, accoglienza da parte della nostra guida marocchina che accompagnerà il gruppo per tutto il viaggio. Partenza verso la città imperiale di Meknes, per una visita panoramica della città e delle mura di Bab el Mansour. Proseguimento verso Fez. Arrivo nel tardo pomeriggio. Cena e pernottamento in hotel.\n\nNOTA IMPORTANTE: Attualmente la città di Meknes è in fase di ristrutturazione, il che rende impossibile visitarla a causa del gran numero di importanti lavori in corso.',
            pt: 'Translado dos diferentes pontos de recolha da Costa del Sol em direção a Tarifa. Embarque em ferry de Tarifa em direção a Tânger. À chegada, espera-nos o nosso guia marroquino que acompanhará durante todo o percurso. Saída em direção à cidade imperial de Meknes, para fazer uma visita panorâmica da cidade e das muralhas de Bab el Mansour. Continuação em direção a Fez. Chegada ao final da tarde. Jantar e alojamento no hotel.\n\nNOTA IMPORTANTE: Atualmente a cidade de Meknes encontra-se em remodelação, o que torna impossível visitá-la devido à grande quantidade de obras importantes que estão a ser realizadas.',
          },
          mealsJsonb: { ar: 'عشاء', en: 'Dinner', es: 'Cena', it: 'Cena', pt: 'Jantar' },
          sortOrder: 0,
        },
        {
          dayLabel: 'Day 2',
          descriptionJsonb: {
            ar: 'الإفطار. زيارة كاملة للمدينة التي تعتبر العاصمة الدينية للبلاد. تأسست في القرن الثامن على يد إدريس الثاني، وتعتبر واحدة من العواصم الإمبراطورية الأربع للمغرب. خلال هذه الزيارة، يتم إجراء جولة في الأماكن الأكثر تميزاً مثل التصميم الخارجي للقصر الملكي، الحي اليهودي، والقلعة التي تتمتع بأفضل إطلالة على فاس البالي. العشاء والإقامة في الفندق.',
            en: 'Breakfast. Full visit of the city considered the religious capital of the country. Founded in the 8th century by Idriss II, it is considered one of the 4 imperial capitals of Morocco. During this visit, a tour is made of the most emblematic places such as the exterior of the Royal Palace, the Jewish quarter, and the fortress. Dinner and accommodation at the hotel.',
            es: 'Desayuno. Visita completa de la ciudad considerada la capital religiosa del país. Fundada en el siglo VIII por Idriss II. Durante esta visita se realiza un recorrido por los lugares más emblemáticos como los exteriores del Palacio Real, el barrio judío y la fortaleza. Cena y alojamiento en el hotel.',
            it: 'Colazione. Visita completa della città considerata la capitale religiosa del paese. Fondata nell\'VIII secolo da Idriss II. Durante questa visita si effettuerà un tour dei luoghi più emblematici come l\'esterno del Palazzo Reale, il quartiere ebraico e la fortezza. Cena e pernottamento in hotel.',
            pt: 'Pequeno-almoço. Visita completa da cidade considerada a capital religiosa do país. Fundada no século VIII por Idriss II. Durante esta visita realiza-se um percurso pelos locais mais emblemáticos como o exterior do Palácio Real, o bairro judeu e a fortaleza. Jantar e alojamento no hotel.',
          },
          mealsJsonb: { ar: 'إفطار + عشاء', en: 'Breakfast + Dinner', es: 'Desayuno + Cena', it: 'Colazione + Cena', pt: 'Pequeno-almoço + Jantar' },
          sortOrder: 1,
        },
        {
          dayLabel: 'Day 3',
          descriptionJsonb: {
            ar: 'الإفطار. المغادرة مبكراً نحو الرباط، عاصمة البلاد، لزيارة الأماكن الأكثر تميزاً في هذه المدينة مثل التصميم الخارجي للقصر الملكي، ضريح محمد الخامس، وصومعة حسان. المتابعة نحو الدار البيضاء لزيارة ساحة الأمم المتحدة، كورنيش عين الذئاب، والتصميم الخارجي لمسجد الحسن الثاني. وقت حر للغداء ثم المتابعة نحو مراكش. الإقامة في الفندق.',
            en: 'Breakfast. Early departure to Rabat, capital of the country, to visit the Royal Palace exterior, Mausoleum of Mohamed V, and Hassan Tower. Continuation to Casablanca to visit United Nations Square, Boulevard de la Corniche, and Hassan II Mosque exterior. Free time for lunch en route and continuation to Marrakech. Accommodation at hotel.',
            es: 'Desayuno. Salida temprano hacia Rabat, capital del país, para visitar los exteriores del palacio real, el Mausoleo de Mohamed V y la torre Hassan. Continuación hacia Casablanca para visitar la plaza de las Naciones Unidas, el Boulevard de la Corniche y los exteriores de la mezquita de Hassan II. Almuerzo libre en ruta y continuación hacia Marrakech. Alojamiento en el hotel.',
            it: 'Colazione. Partenza verso Rabat per visitare l\'esterno del palazzo reale, il Mausoleo di Mohamed V e la torre Hassan. Proseguimento verso Casablanca per visitare la piazza delle Nazioni Unite, il Boulevard de la Corniche e l\'esterno della moschea di Hassan II. Pranzo libero e proseguimento verso Marrakech. Pernottamento in hotel.',
            pt: 'Pequeno-almoço. Saída em direção a Rabat para visitar o exterior do palácio real, o Mausoléu de Mohamed V e a torre Hassan. Continuação em direção a Casablanca para visitar a Praça das Nações Unidas, o Boulevard de la Corniche e o exterior da mesquita de Hassan II. Almoço livre e continuação para Marraquexe. Alojamento no hotel.',
          },
          mealsJsonb: { ar: 'إفطار', en: 'Breakfast', es: 'Desayuno', it: 'Colazione', pt: 'Pequeno-almoço' },
          sortOrder: 2,
        },
        {
          dayLabel: 'Day 4',
          descriptionJsonb: {
            ar: 'الإفطار. زيارة مدينة مراكش: حدائق المنارة، مئذنة الكتبية، وقصر الباهية. الوصول إلى ساحة جامع الفناء والدخول إلى الأسواق والمدينة القديمة. الغداء في فندق بمراكش ثم المغادرة نحو الدار البيضاء. العشاء والإقامة في الفندق.',
            en: 'Breakfast. Visit Marrakech: Menara Gardens, Koutoubia minaret exterior, Bahia Palace, and Jemaa el Fna square. Lunch at hotel in Marrakech and departure to Casablanca. Dinner and accommodation at hotel.',
            es: 'Desayuno. Visita de Marrakech: Jardines de la Menara, minarete de la Koutoubia, Palacio de la Bahía y plaza de Jemaa el Fna. Almuerzo en hotel de Marrakech y posterior salida hacia Casablanca. Cena y alojamiento en el hotel.',
            it: 'Colazione. Visita di Marrakech: Giardini della Menara, minareto della Koutoubia, Palazzo della Bahia e piazza Jemaa el Fna. Pranzo in hotel a Marrakech e partenza verso Casablanca. Cena e pernottamento in hotel.',
            pt: 'Pequeno-almoço. Visita de Marraquexe: Jardins da Menara, minarete da Koutoubia, Palácio da Bahia e praça de Jemaa el Fna. Almoço no hotel em Marraquexe e saída para Casablanca. Jantar e alojamento no hotel.',
          },
          mealsJsonb: { ar: 'إفطار + غداء + عشاء', en: 'Breakfast + Lunch + Dinner', es: 'Desayuno + Almuerzo + Cena', it: 'Colazione + Pranzo + Cena', pt: 'Pequeno-almoço + Almoço + Jantar' },
          sortOrder: 3,
        },
        {
          dayLabel: 'Day 5',
          descriptionJsonb: {
            ar: 'الإفطار. المغادرة نحو طنجة والنقل إلى الميناء للمغادرة بالعبارة نحو طريفة. المتابعة نحو كوستا ديل سول والنقل للمطار للعودة للوطن.',
            en: 'Breakfast. Departure to Tangier and transfer to the port for ferry departure to Tarifa. Continuation to Costa del Sol and airport transfer for return flight.',
            es: 'Desayuno. Salida hacia Tánger y traslado al puerto para salida en ferry hacia Tarifa. Continuación hacia Costa del Sol y traslado al aeropuerto.',
            it: 'Colazione. Partenza verso Tangeri e trasferimento al porto per il traghetto per Tarifa. Proseguimento verso la Costa del Sol e trasferimento in aeroporto.',
            pt: 'Pequeno-almoço. Saída para Tânger e translado para o porto para saída em ferry para Tarifa. Continuação para a Costa del Sol e translado para o aeroporto.',
          },
          mealsJsonb: { ar: 'إفطار', en: 'Breakfast', es: 'Desayuno', it: 'Colazione', pt: 'Pequeno-almoço' },
          sortOrder: 4,
        },
      ],
      images: [
        'https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?auto=format&fit=crop&w=1920&q=80',
        'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=80',
      ],
    },
    {
      slug: 'cairo-express-4d',
      titleJsonb: {
        pt: 'Cairo Express',
        ar: 'القاهرة اكسبرس',
        en: 'Cairo Express',
        es: 'Cairo Express',
        it: 'Cairo Express',
      },
      category: 'egypt',
      country: 'Egypt',
      city: 'Cairo',
      basePriceUsd: 450,
      durationJsonb: {
        pt: '4 Dias / 3 Noites',
        ar: '4 أيام / 3 ليالٍ',
        en: '4 Days / 3 Nights',
        es: '4 Días / 3 Noches',
        it: '4 Giorni / 3 Notti',
      },
      overviewJsonb: {
        pt: 'Roteiro intenso de quatro dias explorando o coração do Egito Antigo. Visite as Pirâmides de Giza, a Esfinge, Memphis, Sakkara, o Grand Egyptian Museum, a Mesquita de Alabastro e o vibrante Mercado Khan El Khalili. Pacote completo com traslados, hospedagem e visto inclusos.',
        ar: 'برنامج مكثف لمدة أربعة أيام لاستكشاف قلب مصر القديمة. زيارة أهرامات الجيزة، أبو الهول، ممفيس، سقارة، المتحف المصري الكبير، مسجد الألباستر، وسوق خان الخليلي النابض بالحياة. باقة كاملة تشمل التوصيلات، الإقامة، والتأشيرة.',
        en: 'An intense 4-day itinerary exploring the heart of Ancient Egypt. Visit the Pyramids of Giza, the Sphinx, Memphis, Saqqara, the Grand Egyptian Museum, the Alabaster Mosque, and the vibrant Khan El Khalili market. Complete package with transfers, accommodation, and visa included.',
        es: 'Un itinerario intenso de 4 días explorando el corazón del Antiguo Egipto. Visita las Pirámides de Guiza, la Esfinge, Menfis, Saqqara, el Gran Museo Egipcio, la Mezquita de Alabastro y el vibrante Mercado Khan El Khalili.',
        it: 'Un intenso itinerario di 4 giorni alla scoperta del cuore dell\'Antico Egitto. Visita le Piramidi di Giza, la Sfinge, Menfi, Saqqara, il Grand Egyptian Museum, la Moschea di Alabastro e il mercato di Khan El Khalili.',
      },
      includedServicesJsonb: {
        pt: [
          '03 noites de hospedagem no Cairo em hotel de categoria escolhida com café da manhã e taxas',
          'Traslados: Aeroporto / Hotel / Aeroporto em serviço regular.',
          'Assistência no Aeroporto conforme roteiro',
          'Passeio no Cairo às Pirâmides e Esfinge, Memphis e Sakkara, Mastabas e Pirâmide de Teti',
          'Passeio e entrada ao Grand Egyptian Museum, Mesquita, Bairro Copta e Mercado Khan El Khalili',
        ],
        ar: [
          'إقامة لمدة 03 ليالٍ في القاهرة بالفندق المختار مع الإفطار والضرائب',
          'الانتقالات: المطار / الفندق / المطار بشركات خدمة منتظمة',
          'المساعدة بالمطار حسب خطة السير',
          'جولة القاهرة إلى الأهرامات وأبو الهول، ممفيس وسقارة، المصاطب وهرم تيتي',
          'جولة ودخول المتحف المصري الكبير، المسجد، الحي القبطي، وسوق خان الخليلي',
        ],
        en: [
          '03 nights accommodation in Cairo in chosen hotel category with breakfast and taxes',
          'Transfers: Airport / Hotel / Airport in regular service',
          'Airport assistance as per itinerary',
          'Cairo tour to Pyramids & Sphinx, Memphis & Saqqara, Mastabas and Pyramid of Teti',
          'Tour and entry to Grand Egyptian Museum, Mosque, Coptic Quarter and Khan El Khalili Market',
        ],
      },
      excludedServicesJsonb: {
        pt: [
          'Todas as bebidas durante o almoço e jantar nos passeios não estão inclusas',
          'Gorjetas aos maleteiros e carregadores obrigatórias',
          'Visto obrigatório 35$ pp, um representante lhe aguardando no desembarque para lhe entregar o visto e lhe auxiliar na imigração',
        ],
        ar: [
          'جميع المشروبات أثناء وجبتي الغداء والعشاء في الجولات غير شاملة',
          'إكراميات حاملي الحقائب والشيالين إجبارية',
          'التأشيرة الإجبارية 35$ للشخص، ممثل بانتظارك عند الوصول لتسليم التأشيرة والمساعدة في الجوازات',
        ],
        en: [
          'All beverages during lunches and dinners on tours are not included',
          'Mandatory porterage and tips',
          'Mandatory entry visa $35 per person, representative awaiting upon arrival to assist with visa and immigration',
        ],
      },
      itineraries: [
        {
          dayLabel: 'Day 1',
          descriptionJsonb: {
            pt: 'Chegada no Aeroporto Internacional do Cairo. Traslado para o Hotel. Conforme o horário de chegada é possível oferecer algum passeio opcional.',
            ar: 'الوصول إلى مطار القاهرة الدولي والنقل إلى الفندق. حسب وقت الوصول، يمكن تقديم بعض الجولات الاختيارية.',
            en: 'Arrival at Cairo International Airport and transfer to Hotel. Optional tours available depending on arrival time.',
            es: 'Llegada al Aeropuerto Internacional del Cairo y traslado al Hotel.',
            it: 'Arrivo all\'Aeroporto Internazionale del Cairo e trasferimento in Hotel.',
          },
          sortOrder: 0,
        },
        {
          dayLabel: 'Day 2',
          descriptionJsonb: {
            pt: 'Pirâmides, Esfinge, Fábrica de Papiros, Memphis e Sakkara. Café da manhã no hotel e saída para visita às pirâmides de Giza: Quéops, Quefren e Miquerinos. Mirante das Pirâmides, Esfinge, Memphis, Pirâmide de Djoser, almoço em restaurante local, mastabas, Pirâmide de Teti e fábrica de papiros. Retorno ao hotel.',
            ar: 'الأهرامات، أبو الهول، مصنع البردي، ممفيس وسقارة. الإفطار بالفندق والانطلاق لزيارة أهرامات الجيزة: خوفو، خفرع، ومنقرع. البانوراما، زيارة أبو الهول، ممفيس وسقارة، هرم زوسر، الغداء بمطعم محلي، المصاطب، هرم تيتي، ومصنع البردي. العودة للفندق.',
            en: 'Pyramids, Sphinx, Papyrus Factory, Memphis and Saqqara. Breakfast at hotel and departure to visit Giza Pyramids: Khufu, Khafre, and Menkaure. Panoramic view, Sphinx visit, Memphis, Djoser Step Pyramid, local restaurant lunch, Mastabas, Teti Pyramid, and papyrus factory stop.',
            es: 'Pirámides de Guiza, Esfinge, Fábrica de Papiros, Menfis y Saqqara. Almuerzo incluido.',
            it: 'Piramidi di Giza, Sfinge, Fabbrica di Papiri, Menfi e Saqqara. Pranzo incluso.',
          },
          sortOrder: 1,
        },
        {
          dayLabel: 'Day 3',
          descriptionJsonb: {
            pt: 'Novo Museu (GEM), Mesquita de Alabastro, Mercado Khan El Khalili. Café da manhã no hotel e saída para a visita ao Novo Museu, Mesquita de Alabastro e Cidadela de Saladino, passeio a pé pelo Bairro Copta e ao mercado Khan El Khalili. Almoço em restaurante local. Retorno para o hotel.',
            ar: 'المتحف الجديد (GEM)، مسجد الألباستر، سوق خان الخليلي. الإفطار بالفندق والانطلاق لزيارة المتحف الجديد، مسجد الألباستر، قلعة صلاح الدين، جولة سير في الحي القبطي، وسوق خان الخليلي. الغداء بمطعم محلي، ثم العودة للفندق.',
            en: 'Grand Egyptian Museum (GEM), Alabaster Mosque, Khan El Khalili Market. Breakfast at hotel and departure to visit Grand Egyptian Museum, Alabaster Mosque, Citadel of Saladin, walking tour in Coptic Quarter and Khan El Khalili market. Lunch at local restaurant.',
            es: 'Gran Museo Egipcio (GEM), Mezquita de Alabastro, Mercado Khan El Khalili.',
            it: 'Grand Egyptian Museum (GEM), Moschea di Alabastro, Mercato Khan El Khalili.',
          },
          sortOrder: 2,
        },
        {
          dayLabel: 'Day 4',
          descriptionJsonb: {
            pt: 'Cairo / Aeroporto. Café da manhã no hotel e saída ao Aeroporto para voo internacional de retorno ao seu país de origem. Fim de nossos serviços.',
            ar: 'القاهرة / المطار. الإفطار بالفندق ثم الخروج للمطار لاستقلال رحلة الطيران الدولية للعودة للوطن. نهاية خدماتنا.',
            en: 'Cairo / Airport. Breakfast at hotel and transfer to Airport for international departure flight. End of our services.',
            es: 'El Cairo / Aeropuerto. Traslado al aeropuerto para el vuelo de regreso.',
            it: 'Il Cairo / Aeroporto. Trasferimento in aeroporto per il volo di retorno.',
          },
          sortOrder: 3,
        },
      ],
      images: [
        'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?q=80&w=1200',
        'https://images.unsplash.com/photo-1572252821143-035a0f6700c2?q=80&w=1200',
        'https://images.unsplash.com/photo-1539650116574-75c0c6d73c0e?q=80&w=1200',
      ],
    },
    {
      slug: 'passion-of-turkey',
      titleJsonb: {
        en: 'Passion of Turkey',
        es: 'Pasión de Turquía',
        ar: 'عشق تركيا',
        pt: 'Paixão da Turquia',
        it: 'Passione della Turchia',
      },
      category: 'turkey',
      basePriceUsd: 1200,
      durationJsonb: {
        en: '10 Days / 9 Nights',
        es: '10 Días / 9 Noches',
        ar: '10 أيام / 9 ليالي',
      },
      overviewJsonb: {
        en: 'Discover the magic of Turkey — from the minarets of Istanbul to the otherworldly landscapes of Cappadocia.',
        es: 'Descubre la magia de Turquía.',
        ar: 'اكتشف سحر تركيا من مآذن إسطنبول إلى تضاريس كابادوكيا.',
      },
      itineraries: [
        {
          dayLabel: 'Day 1',
          descriptionJsonb: {
            en: 'Arrival in Istanbul. Transfer to hotel. Welcome dinner.',
            ar: 'الوصول إلى إسطنبول. نقل إلى الفندق. عشاء ترحيبي.',
          },
          sortOrder: 0,
        },
        {
          dayLabel: 'Day 2',
          descriptionJsonb: {
            en: 'Full day tour of the Hagia Sophia, Blue Mosque, and Grand Bazaar.',
            ar: 'جولة كاملة في آيا صوفيا والمسجد الأزرق والبازار الكبير.',
          },
          sortOrder: 1,
        },
      ],
      images: [
        'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=1200',
        'https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?w=1200',
      ],
    },
    {
      slug: 'wonders-of-egypt',
      titleJsonb: {
        en: 'Wonders of Egypt',
        es: 'Maravillas de Egipto',
        ar: 'عجائب مصر',
        pt: 'Maravilhas do Egito',
        it: "Meraviglie dell'Egitto",
      },
      category: 'egypt',
      basePriceUsd: 950,
      durationJsonb: {
        en: '8 Days / 7 Nights',
        es: '8 Días / 7 Noches',
        ar: '8 أيام / 7 ليالي',
      },
      overviewJsonb: {
        en: 'Walk in the footsteps of pharaohs. Explore the Great Pyramids, cruise the Nile, and uncover ancient temples.',
        es: 'Camina en los pasos de los faraones.',
        ar: 'اتبع خطى الفراعنة. استكشف الأهرامات العظيمة وابحر في النيل.',
      },
      itineraries: [
        {
          dayLabel: 'Day 1',
          descriptionJsonb: {
            en: 'Arrival in Cairo. Transfer to hotel. Orientation tour.',
            ar: 'الوصول إلى القاهرة. نقل إلى الفندق. جولة تعريفية.',
          },
          sortOrder: 0,
        },
        {
          dayLabel: 'Day 2',
          descriptionJsonb: {
            en: 'Visit the Great Pyramids of Giza and the Sphinx.',
            ar: 'زيارة أهرامات الجيزة العظيمة وأبو الهول.',
          },
          sortOrder: 1,
        },
      ],
      images: [
        'https://images.unsplash.com/photo-1539650116574-75c0c6d73c0e?w=1200',
        'https://images.unsplash.com/photo-1568322445389-f64ac2515020?w=1200',
      ],
    },
    {
      slug: 'jewels-of-jordan',
      titleJsonb: {
        en: 'Jewels of Jordan',
        es: 'Joyas de Jordania',
        ar: 'جواهر الأردن',
        pt: 'Jóias da Jordânia',
        it: 'Gioielli della Giordania',
      },
      category: 'jordan',
      basePriceUsd: 1100,
      durationJsonb: {
        en: '7 Days / 6 Nights',
        ar: '7 أيام / 6 ليالي',
      },
      overviewJsonb: {
        en: 'From the rose-red city of Petra to the vast silence of Wadi Rum — Jordan is a land of timeless wonder.',
        ar: 'من مدينة البتراء الوردية إلى صحراء وادي رم الشاسعة.',
      },
      itineraries: [
        {
          dayLabel: 'Day 1',
          descriptionJsonb: {
            en: 'Arrival in Amman. Transfer to hotel.',
            ar: 'الوصول إلى عمّان. نقل إلى الفندق.',
          },
          sortOrder: 0,
        },
      ],
      images: [
        'https://images.unsplash.com/photo-1548786811-dd4f764bc046?w=1200',
      ],
    },
  ];

  for (const t of fallbackTours) {
    const existing = await prisma.tour.findUnique({
      where: { slug: t.slug },
    });

    if (existing) {
      console.log(`  ↩  Already exists: ${t.slug}`);
      continue;
    }

    const { itineraries, images, ...tourData } = t;

    const tour = await prisma.tour.create({
      data: { ...tourData, isActive: true },
    });

    for (const day of itineraries) {
      await prisma.tourItinerary.create({
        data: { tourId: tour.id, ...day },
      });
    }

    for (let i = 0; i < images.length; i++) {
      await prisma.tourImage.create({
        data: {
          tourId: tour.id,
          imageUrl: images[i],
          isHero: i === 0,
          sortOrder: i,
        },
      });
    }

    console.log(`  ✅ Fallback seeded: ${t.slug}`);
  }
}

async function seedContactSubmissions(): Promise<void> {
  console.log('\n📌 Seeding contact submissions...');
  const submissions = [
    {
      referenceCode: 'CON-A1B2C3',
      status: 'NEW',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      subject: 'Group Tour Inquiry',
      message: 'I would like to organize a group tour for 10 people.',
      locale: 'en',
    },
    {
      referenceCode: 'CON-X9Y8Z7',
      status: 'READ',
      firstName: 'Bob',
      lastName: 'Jones',
      email: 'bob@example.com',
      subject: 'Payment Question',
      message: 'Do you accept wire transfers?',
      locale: 'en',
    },
    {
      referenceCode: 'CON-M5N6P7',
      status: 'ARCHIVED',
      firstName: 'Carlos',
      lastName: 'Santana',
      email: 'carlos@example.com',
      subject: 'Información sobre tours',
      message: 'Me gustaría recibir información sobre los tours en español.',
      locale: 'es',
    },
  ];

  for (const sub of submissions) {
    const existing = await prisma.contactSubmission.findUnique({
      where: { referenceCode: sub.referenceCode },
    });

    if (existing) {
      console.log(`  ↩  Already exists: ${sub.referenceCode}`);
      continue;
    }

    try {
      // Need to cast the status string to the enum type generated by Prisma
      await prisma.contactSubmission.create({
        data: {
          ...sub,
          status: sub.status as 'NEW' | 'READ' | 'ARCHIVED',
        },
      });
      console.log(`  ✅ Seeded contact submission: ${sub.referenceCode}`);
    } catch (err) {
      console.error(
        `  ❌ Failed to seed contact submission: ${sub.referenceCode}`,
        err,
      );
    }
  }
}

async function seedSuperAdmin(): Promise<void> {
  console.log('\n📌 Seeding super admin...');
  const email = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log(
      '  ↩  Super admin bootstrap skipped (one-time credentials are not configured).',
    );
    return;
  }

  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_PRODUCTION_ADMIN_BOOTSTRAP !== 'true'
  ) {
    throw new Error(
      'Refusing production bootstrap without ALLOW_PRODUCTION_ADMIN_BOOTSTRAP=true.',
    );
  }

  if (
    password.length < 16 ||
    /password|admin|dunas|1234|qwerty/i.test(password)
  ) {
    throw new Error(
      'BOOTSTRAP_SUPER_ADMIN_PASSWORD must be at least 16 characters and unpredictable.',
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    console.log('  ↩  Super admin already exists; seed will not modify it.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      email,
      name: 'Super Admin',
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      isVerified: true,
    },
  });
  console.log('  ✅ One-time super admin bootstrap completed.');
}

async function seedCmsBlocks(): Promise<void> {
  console.log('\n📌 Seeding default CMS blocks...');
  const blocks = [
    { key: 'homepage-hero', content: { en: 'Welcome to Dunas Travel' } },
    { key: 'footer-info', content: { en: '© 2026 Dunas Travel' } },
    {
      key: 'hotels_catalog',
      content: [
        {
          id: 'htl-eg-01',
          name: 'Four Seasons Hotel Cairo at Nile Plaza',
          destination: 'egypt',
          city: 'Cairo',
          stars: 5,
          rating: 4.9,
          pricePerNight: 350,
          image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
          description: 'إطلالة بانورامية ساحرة على نهر النيل وقلب القاهرة التاريخية مع خدمات كونسيرج فاخرة على مدار الساعة.',
          amenities: ['Spa & Wellness', 'Nile View', 'Fine Dining', 'Infinity Pool']
        },
        {
          id: 'htl-eg-02',
          name: 'Sofitel Legend Old Cataract Aswan',
          destination: 'egypt',
          city: 'Aswan',
          stars: 5,
          rating: 4.95,
          pricePerNight: 420,
          image: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80',
          description: 'قصر تاريخي فخم على ضفاف النيل بأسوان استضاف أشهر ملوك العالم وأجاثا كريستي.',
          amenities: ['Historic Palace', 'Royal Suite', 'Sunset Terrace', 'Luxury Spa']
        },
        {
          id: 'htl-tr-01',
          name: 'Ciragan Palace Kempinski Istanbul',
          destination: 'turkey',
          city: 'Istanbul',
          stars: 5,
          rating: 4.9,
          pricePerNight: 500,
          image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80',
          description: 'القصر العثماني الوحيد على مضيق البوسفور الذي يقدم تجربة إقامة ملكية استثنائية.',
          amenities: ['Bosphorus View', 'Ottoman Cuisine', 'Helipad', 'Heated Pool']
        },
        {
          id: 'htl-jo-01',
          name: 'Kempinski Hotel Ishtar Dead Sea',
          destination: 'jordan',
          city: 'Dead Sea',
          stars: 5,
          rating: 4.85,
          pricePerNight: 280,
          image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=800&q=80',
          description: 'ملاذ استرخاء فاخر على شاطئ البحر الميت محاط بحدائق معلقة وبحيرات سباحة خاصة.',
          amenities: ['Private Beach', 'Dead Sea Mud Spa', '9 Pools', 'Fine Dining']
        }
      ]
    },
    {
      key: 'holiday_packages',
      content: [
        {
          id: 'pkg-egypt-classic',
          title: 'برنامج مصر الكلاسيكي الشامل (القاهرة والنيل)',
          slug: 'egypt-classic-package',
          destination: 'Multi-City Egypt',
          duration: '8 أيام / 7 ليالي',
          price: 1850,
          type: 'Classic Holiday',
          popular: true,
          description: 'رحلة كلاسيكية فاخرة تشمل أهرامات الجيزة، المتحف الكبير، وإقامة كروز 5 نجوم بين الأقصر وأسوان.',
          image: 'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?auto=format&fit=crop&w=800&q=80'
        },
        {
          id: 'pkg-egypt-dubai',
          title: 'باكدج مصر ودبي الفاخر (Multi-Country)',
          slug: 'egypt-dubai-combo',
          destination: 'Multi-Country',
          duration: '10 أيام / 9 ليالي',
          price: 2450,
          type: 'Luxury Combo',
          popular: true,
          description: 'أفضل دمج بين سحر الحضارة الفرعونية وفخامة أبراج وتسوق دبي مع إقامة في فنادق 5 نجوم.',
          image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80'
        },
        {
          id: 'pkg-honeymoon-redsea',
          title: 'باكدج شهر العسل (القاهرة والجونة)',
          slug: 'honeymoon-red-sea',
          destination: 'Egypt Resorts',
          duration: '7 أيام / 6 ليالي',
          price: 1650,
          type: 'Honeymoon',
          popular: false,
          description: 'عطلة رومانسية هادئة تشمل منتجعات الجونة الفاخرة، يخت خاص في البحر الأحمر، وعشاء فاخر على ضفاف النيل.',
          image: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=800&q=80'
        }
      ]
    },
    {
      key: 'transportation_fleet',
      content: [
        {
          id: 'veh-bus-01',
          name: 'Mercedes-Benz Tourismo VIP Coach',
          category: 'bus',
          seats: 48,
          doors: 2,
          rating: 4.95,
          pricePerDay: 450,
          image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
          features: ['تكييف هوائي كامل', 'واي فاي 5G مجاني', 'مقاعد جلدية مريحة', 'شاشات عرض ترفيهية', 'ثلاجة ومشروبات', 'سائق محترف متعدد اللغات']
        },
        {
          id: 'veh-van-01',
          name: 'Mercedes-Benz Sprinter Executive',
          category: 'van',
          seats: 14,
          doors: 2,
          rating: 4.9,
          pricePerDay: 280,
          image: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=800&q=80',
          features: ['مقاعد VIP قابلة للإمالة', 'منافذ شحن USB', 'واي فاي مجاني', 'عازل صوت ممتاز', 'إضاءة محيطية هادئة']
        },
        {
          id: 'veh-sedan-01',
          name: 'Mercedes-Benz S-Class Maybach Edition',
          category: 'luxury_sedan',
          seats: 4,
          doors: 4,
          rating: 5.0,
          pricePerDay: 350,
          image: 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=800&q=80',
          features: ['خدمة VIP Chauffeur', 'مقاعد مساج وتبريد', 'شامبانيا وضيافة فاخرة', 'نظام صوتي Burmester']
        },
        {
          id: 'veh-suv-01',
          name: 'Toyota Land Cruiser V8 Safari 4x4',
          category: 'suv',
          seats: 6,
          doors: 5,
          rating: 4.85,
          pricePerDay: 220,
          image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80',
          features: ['دفع رباعي للصحراء والسفاري', 'قفص حماية معزز', 'نظام تبريد صحراوي فائق', 'جهاز ملاحة GPS واتصال بالأقمار الصناعية']
        }
      ]
    }
  ];

  for (const block of blocks) {
    const existing = await prisma.cmsBlock.findUnique({
      where: { key: block.key },
    });

    if (existing) {
      console.log(`  ↩  Already exists: ${block.key}`);
      continue;
    }

    await prisma.cmsBlock.create({
      data: {
        key: block.key,
        content: block.content,
      },
    });
    console.log(`  ✅ Seeded CMS block: ${block.key}`);
  }
}

async function seedMockBookings(): Promise<void> {
  console.log('\n📌 Seeding mock bookings, customers, and finance...');
  const tours = await prisma.tour.findMany();
  if (tours.length === 0) {
    console.log('  ⚠  No tours found to attach bookings to.');
    return;
  }

  // Create mock users (customers)
  const customers = [];
  for (let i = 1; i <= 5; i++) {
    let customer = await prisma.user.findUnique({
      where: { email: `customer${i}@example.com` },
    });
    if (!customer) {
      customer = await prisma.user.create({
        data: {
          email: `customer${i}@example.com`,
          name: `Customer ${i}`,
          passwordHash: 'dummy',
          role: 'USER',
          status: 'ACTIVE',
          customerNumber: `CUST-100${i}`,
        },
      });
    }
    customers.push(customer);
  }

  // Create wallet for first customer
  let wallet = await prisma.wallet.findUnique({
    where: {
      ownerType_ownerId: { ownerType: 'USER', ownerId: customers[0].id },
    },
  });
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: {
        ownerType: 'USER',
        ownerId: customers[0].id,
        balance: 500.0,
        currency: 'USD',
      },
    });
    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: 500.0,
        type: 'CREDIT',
        referenceType: 'MANUAL_ADDITION',
        status: 'COMPLETED',
      },
    });
  }

  // Create some bookings
  for (let i = 1; i <= 10; i++) {
    const refCode = `BKG-2026-${i.toString().padStart(3, '0')}`;
    const existing = await prisma.booking.findUnique({
      where: { referenceCode: refCode },
    });
    if (existing) continue;

    const tour = tours[i % tours.length];
    const customer = customers[i % customers.length];

    const booking = await prisma.booking.create({
      data: {
        referenceCode: refCode,
        userId: customer.id,
        tourId: tour.id,
        status: i % 3 === 0 ? 'CONFIRMED' : 'PENDING',
        arrivalDate: new Date(new Date().getTime() + i * 86400000 * 5),
        totalAmountUsd: tour.basePriceUsd,
        paidAmountUsd: i % 3 === 0 ? tour.basePriceUsd : 0,
        adults: 2,
        bookingType: 'BOOKING',
        priority: 'MEDIUM',
        billingInfo: {
          create: {
            fullName: customer.name,
            email: customer.email,
            phone: '+1234567890',
            invoiceType: 'PERSONAL',
          },
        },
        passengers: {
          create: [
            { passengerType: 'ADULT', fullName: customer.name },
            { passengerType: 'ADULT', fullName: `Partner of ${customer.name}` },
          ],
        },
      },
    });

    if (Number(booking.paidAmountUsd) > 0) {
      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          amount: booking.paidAmountUsd,
          currency: 'USD',
          method: 'CREDIT_CARD',
          status: 'CAPTURED',
          transactionId: `txn_${Date.now()}`,
        },
      });
      await prisma.invoice.create({
        data: {
          bookingId: booking.id,
          invoiceNumber: `INV-${refCode}`,
        },
      });
    }

    console.log(`  ✅ Seeded booking: ${refCode}`);
  }
}

async function seedTourLandingPages(): Promise<void> {
  console.log('\n📌 Seeding Tour Landing Pages (Interfaces)...');

  const landingPagesData = [
    {
      slug: 'egypt',
      type: 'DESTINATION',
      titleJsonb: {
        en: 'Egypt',
        es: 'Egipto',
        ar: 'مصر',
        pt: 'Egito',
        it: 'Egitto',
      },
      subtitleJsonb: {
        en: 'Land of the Pharaohs',
        es: 'Tierra de los Faraones',
        ar: 'أرض الفراعنة',
        pt: 'Terra dos Faraós',
        it: 'Terra dei Faraoni',
      },
      descriptionJsonb: {
        en: 'From the timeless Pyramids of Giza to the golden temples of Luxor and the crystal waters of the Red Sea, Egypt offers a journey through history like no other.',
        es: 'Desde las pirámides hasta el mar Rojo, descubre la cuna de la civilización.',
        ar: 'من أهرامات الجيزة إلى معابد الأقصر وشواطئ البحر الأحمر الساحرة.',
        pt: 'Das pirâmides ao Rio Nilo, viva uma experiência inesquecível.',
        it: 'Dalle piramidi al Nilo, un viaggio straordinario.',
      },
      heroImageUrl: '/imgs/egyothero.png',
      status: 'PUBLISHED',
      isActive: true,
      sortOrder: 1,
    },
    {
      slug: 'turkey',
      type: 'DESTINATION',
      titleJsonb: {
        en: 'Turkey',
        es: 'Turquía',
        ar: 'تركيا',
        pt: 'Turquia',
        it: 'Turchia',
      },
      subtitleJsonb: {
        en: 'Where East Meets West',
        es: 'Donde Oriente se encuentra con Occidente',
        ar: 'ملتقى الشرق والغرب',
        pt: 'Onde o Oriente se Encontra com o Ocidente',
        it: "Dove l'Oriente Incontra l'Occidente",
      },
      descriptionJsonb: {
        en: 'Explore Istanbul, the fairy chimneys of Cappadocia, ancient Ephesus, and travertine pools of Pamukkale.',
        es: 'Descubre Estambul, Capadoccia y los tesoros de Turquía.',
        ar: 'استكشف إسطنبول وكابادوكيا ومناظر تركيا الطبيعية التاريخية.',
        pt: 'Conheça Istambul e os balões da Capadócia.',
        it: 'Esplora Istanbul e la Cappadocia.',
      },
      heroImageUrl:
        'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=1200',
      status: 'PUBLISHED',
      isActive: true,
      sortOrder: 2,
    },
    {
      slug: 'jordan',
      type: 'DESTINATION',
      titleJsonb: {
        en: 'Jordan',
        es: 'Jordania',
        ar: 'الأردن',
        pt: 'Jordânia',
        it: 'Giordania',
      },
      subtitleJsonb: {
        en: 'Kingdom of Wonder',
        es: 'Reino de Maravillas',
        ar: 'مملكة العجائب',
        pt: 'Reino das Maravilhas',
        it: 'Regno delle Meraviglie',
      },
      descriptionJsonb: {
        en: 'Walk in the pink-red sandstone canyons of Petra and float on the Dead Sea.',
        es: 'Explora la legendaria ciudad de Petra y el desierto de Wadi Rum.',
        ar: 'زيارة مدينة البتراء الوردية ووادي رم والبحر الميت.',
        pt: 'Descubra Petra e o deserto de Wadi Rum.',
        it: 'Visita la magica città di Petra.',
      },
      heroImageUrl:
        'https://images.unsplash.com/photo-1548786811-dd4f764bc046?w=1200',
      status: 'PUBLISHED',
      isActive: true,
      sortOrder: 3,
    },
    {
      slug: 'morocco',
      type: 'DESTINATION',
      titleJsonb: {
        en: 'Morocco',
        es: 'Marruecos',
        ar: 'المغرب',
        pt: 'Marrocos',
        it: 'Marocco',
      },
      subtitleJsonb: {
        en: 'Land of Colors & Spices',
        es: 'Tierra de Colores y Especias',
        ar: 'أرض الألوان والتوابل',
        pt: 'Terra de Cores e Especiarias',
        it: 'Terra di Colori e Spezie',
      },
      descriptionJsonb: {
        en: 'Discover Marrakech, Fes, Chefchaouen, and the Sahara desert dunes.',
        es: 'Descubre Marrakech, Fez y las dunas del Sahara.',
        ar: 'رحلات عبر مراكش وفاس والصحراء الكبرى.',
        pt: 'Explore as cidades imperiais de Marrocos.',
        it: 'Scopri le città imperiali del Marocco.',
      },
      heroImageUrl:
        'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=1200',
      status: 'PUBLISHED',
      isActive: true,
      sortOrder: 4,
    },
    {
      slug: 'greece',
      type: 'DESTINATION',
      titleJsonb: {
        en: 'Greece',
        es: 'Grecia',
        ar: 'اليونان',
        pt: 'Grécia',
        it: 'Grecia',
      },
      subtitleJsonb: {
        en: 'Cradle of Civilization',
        es: 'Cuna de la Civilización',
        ar: 'مهد الحضارة',
        pt: 'Berço da Civilização',
        it: 'Culla della Civiltà',
      },
      descriptionJsonb: {
        en: 'Experience Athens Acropolis and breathtaking Aegean islands.',
        es: 'Atenas, Santorini y las islas griegas.',
        ar: 'استكشف أثينا وجزر اليونان الساحرة.',
        pt: 'Visite Atenas e as ilhas gregas.',
        it: 'Visita Atene e le isole greche.',
      },
      heroImageUrl:
        'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=1200',
      status: 'PUBLISHED',
      isActive: true,
      sortOrder: 5,
    },
    {
      slug: 'dubai',
      type: 'DESTINATION',
      titleJsonb: {
        en: 'Dubai',
        es: 'Dubái',
        ar: 'دبي',
        pt: 'Dubai',
        it: 'Dubai',
      },
      subtitleJsonb: {
        en: 'City of the Future',
        es: 'Ciudad del Futuro',
        ar: 'مدينة المستقبل',
        pt: 'Cidade do Futuro',
        it: 'Città del Futuro',
      },
      descriptionJsonb: {
        en: 'Ultra-modern architecture, desert safaris, and luxury shopping.',
        es: 'Lujo, arquitectura moderna y safaris en el desierto.',
        ar: 'ناطحات السحاب والسفاري والتسوق الفاخر.',
        pt: 'O luxo e a modernidade de Dubai.',
        it: 'Lusso e modernità a Dubai.',
      },
      heroImageUrl:
        'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200',
      status: 'PUBLISHED',
      isActive: true,
      sortOrder: 6,
    },
    {
      slug: 'tunisia',
      type: 'DESTINATION',
      titleJsonb: {
        en: 'Tunisia',
        es: 'Túnez',
        ar: 'تونس',
        pt: 'Tunísia',
        it: 'Tunisia',
      },
      subtitleJsonb: {
        en: 'Oasis & Mediterranean Charm',
        es: 'Oasis y Encanto Mediterráneo',
        ar: 'سحر الواحات والمتوسط',
        pt: 'Oásis e Charme Mediterrâneo',
        it: 'Oasi e Fascino Mediterraneo',
      },
      descriptionJsonb: {
        en: 'Carthage ruins, Sidi Bou Said, and Sahara oases.',
        es: 'Cartago, Sidi Bou Said y los oasis de Túnez.',
        ar: 'آثار قرطاج وسيدي بوسعيد وواحات الصحراء.',
        pt: 'Conheça as ruínas de Cartago e Sidi Bou Said.',
        it: 'Scopri Cartagine e Sidi Bou Said.',
      },
      heroImageUrl:
        'https://images.unsplash.com/photo-1548786811-dd4f764bc046?w=1200',
      status: 'PUBLISHED',
      isActive: true,
      sortOrder: 7,
    },
    {
      slug: 'multi-country',
      type: 'THEME',
      titleJsonb: {
        en: 'Multi-Country Tours',
        es: 'Tours Multipaís',
        ar: 'رحلات متعددة الدول',
        pt: 'Tours Multi-Países',
        it: 'Tour Multi-Paese',
      },
      subtitleJsonb: {
        en: 'Grand Middle East Expeditions',
        es: 'Grandes Expediciones por Medio Oriente',
        ar: 'رحلات شاملة عبر الشرق الأوسط',
        pt: 'Grandes Expedições pelo Oriente Médio',
        it: 'Grandi Spedizioni in Medio Oriente',
      },
      descriptionJsonb: {
        en: 'Combined travel packages covering Egypt, Jordan, Turkey, Dubai, and Morocco.',
        es: 'Paquetes combinados visitando varios países de Medio Oriente.',
        ar: 'رحلات تجمع بين مصر والأردن وتركيا والإمارات والمغرب.',
        pt: 'Pacotes combinando Egito, Jordânia e Turquia.',
        it: 'Pacchetti combinati in Medio Oriente.',
      },
      heroImageUrl:
        'https://res.cloudinary.com/degbrq3ck/image/upload/v1783030113/Gemini_Generated_Image_cb2enncb2enncb2e_wvyejn.jpg',
      status: 'PUBLISHED',
      isActive: true,
      sortOrder: 8,
    },
    {
      slug: 'religious',
      type: 'THEME',
      titleJsonb: {
        en: 'Religious Tours',
        es: 'Tours Religiosos',
        ar: 'رحلات دينية',
        pt: 'Tours Religiosos',
        it: 'Tour Religiosi',
      },
      subtitleJsonb: {
        en: 'Sacred Footsteps & Pilgrimages',
        es: 'Huellas Sagradas y Peregrinaciones',
        ar: 'مسارات مقدسة ورحلات إيمانية',
        pt: 'Pegadas Sagradas e Peregrinações',
        it: 'Impronte Sacre e Pellegrinaggi',
      },
      descriptionJsonb: {
        en: 'Holy land pilgrimages and spiritual journeys across sacred historical sites.',
        es: 'Peregrinaciones a Tierra Santa y sitios sagrados.',
        ar: 'رحلات إيمانية وزيارة المعالم المقدسة.',
        pt: 'Peregrinações pela Terra Santa.',
        it: 'Pellegrinaggi in Terra Santa.',
      },
      heroImageUrl:
        'https://www.saintjeromechurch.org/wp-content/uploads/2025/03/14714-what-is-ccd-in-catholic-church-religious-education-programs-explained.png',
      status: 'PUBLISHED',
      isActive: true,
      sortOrder: 9,
    },
  ];

  for (const page of landingPagesData) {
    const existing = await prisma.tourLandingPage.findUnique({
      where: { slug: page.slug },
    });
    let landingPageId: string;

    if (existing) {
      console.log(`  ↩  Landing Page exists: ${page.slug}`);
      landingPageId = existing.id;
    } else {
      const created = await prisma.tourLandingPage.create({ data: page });
      console.log(`  ✅ Seeded Landing Page: ${page.slug}`);
      landingPageId = created.id;
    }

    // Connect tours matching category, country or slug
    const matchingTours = await prisma.tour.findMany({
      where: {
        OR: [
          { category: { equals: page.slug, mode: 'insensitive' } },
          { country: { equals: page.slug, mode: 'insensitive' } },
          { slug: { contains: page.slug, mode: 'insensitive' } },
        ],
      },
    });

    let sortIndex = 1;
    for (const tour of matchingTours) {
      await prisma.tourLandingPageTour.upsert({
        where: {
          landingPageId_tourId: {
            landingPageId,
            tourId: tour.id,
          },
        },
        create: {
          landingPageId,
          tourId: tour.id,
          sortOrder: sortIndex++,
          isFeatured: tour.isFeatured,
          isVisible: true,
        },
        update: {},
      });
    }

    if (matchingTours.length > 0) {
      console.log(
        `     └ Attached ${matchingTours.length} tours to '${page.slug}'`,
      );
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n🌱 Starting Dunas Travel database seed...\n');
  const isProduction = process.env.NODE_ENV === 'production';
  const seedDemoData = process.env.SEED_DEMO_DATA === 'true';

  if (isProduction || process.env.ALLOW_DEVELOPMENT_SEED !== 'true') {
    throw new Error('Seeds are development-only. Refusing to run without ALLOW_DEVELOPMENT_SEED=true outside production.');
  }

  // Attempt to read programs.json from the frontend
  const possiblePaths = [
    path.join(__dirname, 'data/ahmed-tours.normalized.json'),
    path.join(process.cwd(), 'prisma/data/ahmed-tours.normalized.json'),
  ];

  let programs: RawProgram[] | null = null;

  for (const jsonPath of possiblePaths) {
    if (fs.existsSync(jsonPath)) {
      console.log(`📂 Found programs.json at: ${jsonPath}`);
      try {
        const raw = fs.readFileSync(jsonPath, 'utf-8');
        const parsed: unknown = JSON.parse(raw);

        if (Array.isArray(parsed)) {
          programs = parsed as RawProgram[];
        } else if (
          parsed !== null &&
          typeof parsed === 'object' &&
          'programs' in parsed &&
          Array.isArray((parsed as Record<string, unknown>)['programs'])
        ) {
          programs = (parsed as { programs: RawProgram[] }).programs;
        } else if (parsed !== null && typeof parsed === 'object') {
          programs = Object.values(parsed) as RawProgram[];
        }

        if (programs && programs.length > 0) {
          console.log(`📦 Found ${programs.length} programs to seed\n`);
          break;
        }
      } catch (error) {
        console.warn(`  ⚠  Failed to parse: ${jsonPath}`, error);
      }
    }
  }

  if (programs && programs.length > 0) {
    await seedFromJson(programs);
  } else {
    if (isProduction) {
      throw new Error(
        'Production catalog seed aborted because programs.json was not found.',
      );
    }
    console.warn('⚠  programs.json not found or empty.');
    console.log('📌 Using fallback sample data instead.\n');
    throw new Error('Development reference catalog is missing or empty; sample fallback tours are forbidden.');
  }

  await seedTourLandingPages();
  if (seedDemoData) {
    await seedContactSubmissions();
  }

  await seedSuperAdmin();
  await seedCmsBlocks();

  await seedMediaAssets(prisma);
  if (seedDemoData) {
    await seedMockBookings();
  }

  console.log('\n✅ Seed complete!\n');
}

main()
  .catch((error: unknown) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
