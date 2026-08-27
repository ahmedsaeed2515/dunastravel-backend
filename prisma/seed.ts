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

// â”€â”€â”€ Type Definitions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Seeder Functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function seedFromJson(programs: RawProgram[]): Promise<void> {
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const program of programs) {
    const slug = extractSlug(program);

    if (!slug) {
      console.warn('  âš   Skipping program with no identifiable slug');
      failed++;
      continue;
    }

    const existing = await prisma.tour.findUnique({ where: { slug } });
    if (existing) {
      console.log(`  â†©  Already exists: ${slug}`);
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
        `  âœ… Seeded: ${slug} | $${extractPrice(program)} | ${itinerary.length} days | ${images.length} images`,
      );
      created++;
    } catch (error) {
      console.error(`  âŒ Failed to seed: ${slug}`, error);
      failed++;
    }
  }

  console.log(`\nðŸ“Š Seed Summary:`);
  console.log(`   Created : ${created}`);
  console.log(`   Skipped : ${skipped}`);
  console.log(`   Failed  : ${failed}`);
}

async function seedFallbackTours(): Promise<void> {
  console.log('ðŸ“Œ Seeding fallback sample tours...');

  const fallbackTours = [
{
      slug: 'tunisia-8-days-desert-sea',
      code: 'tunisia-8d-7n-tour',
      titleJsonb: {
        "ar": "Ø¨Ø±Ù†Ø§Ù…Ø¬ ØªÙˆÙ†Ø³ Ø§Ù„Ø®Ø¶Ø±Ø§Ø¡ Ø§Ù„Ù…ØªÙ…ÙŠØ²",
        "en": "Premium Green Tunisia Tour - 8 Days / 7 Nights",
        "es": "Circuito TÃºnez Verde Premium - 8 DÃ­as / 7 Noches",
        "it": "Tour Tunisia Verde Premium - 8 Giorni / 7 Notti",
        "pt": "Circuito TunÃ­sia Verde Premium - 8 Dias / 7 Noites"
},
      category: 'Tunisia',
      country: 'Tunisia',
      city: 'Tunis',
      basePriceUsd: 1328,
      durationJsonb: {
        "ar": "8 Ø£ÙŠØ§Ù… / 7 Ù„ÙŠØ§Ù„ÙŠ",
        "en": "8 Days / 7 Nights",
        "es": "8 DÃ­as / 7 Noches",
        "it": "8 Giorni / 7 Notti",
        "pt": "8 Dias / 7 Noites"
},
      minPaxJsonb: {
        "ar": "ÙØ±Ø¯Ø§Ù†",
        "en": "2 Pax",
        "es": "2 Pax",
        "it": "2 Pax",
        "pt": "2 Pax"
},
      overviewJsonb: {
        "ar": "Ø§Ù†Ø·Ù„Ù‚ ÙÙŠ Ø±Ø­Ù„Ø© Ø³Ø§Ø­Ø±Ø© Ø¹Ø¨Ø± Ø§Ù„Ø²Ù…Ù† ØªØ¬Ù…Ø¹ Ø¨ÙŠÙ† Ø¹Ø¨Ù‚ Ø§Ù„ØªØ§Ø±ÙŠØ® Ø§Ù„Ø±ÙˆÙ…Ø§Ù†ÙŠ ÙˆØ§Ù„Ø¥Ø³Ù„Ø§Ù…ÙŠ Ø§Ù„Ø¹Ø±ÙŠÙ‚ ÙˆØ³Ø­Ø± Ø§Ù„Ø·Ø¨ÙŠØ¹Ø© Ø§Ù„ØµØ­Ø±Ø§ÙˆÙŠØ© Ø§Ù„ÙØ±ÙŠØ¯Ø©. ÙŠÙ…Ù†Ø­Ùƒ Ù‡Ø°Ø§ Ø§Ù„Ø¨Ø±Ù†Ø§Ù…Ø¬ Ø§Ù„Ù…ØªÙƒØ§Ù…Ù„ ÙØ±ØµØ© Ø§Ø³ØªÙƒØ´Ø§Ù ØªÙˆÙ†Ø³ Ø§Ù„Ø®Ø¶Ø±Ø§Ø¡ Ù…Ù† Ø¹Ø§ØµÙ…ØªÙ‡Ø§ Ø§Ù„Ù†Ø§Ø¨Ø¶Ø© Ø¨Ø§Ù„Ø­ÙŠØ§Ø© ÙˆØµÙˆÙ„Ø§Ù‹ Ø¥Ù„Ù‰ Ø¨ÙˆØ§Ø¨Ø§Øª Ø§Ù„ØµØ­Ø±Ø§Ø¡ Ø§Ù„Ø´Ø§Ø³Ø¹Ø©ØŒ Ù…Ø¹ Ø§Ù„Ø§Ø³ØªÙ…ØªØ§Ø¹ Ø¨Ø¥Ù‚Ø§Ù…Ø© ÙØ§Ø®Ø±Ø© ÙˆØ®Ø¯Ù…Ø§Øª Ù…ØªÙƒØ§Ù…Ù„Ø© ØªÙ†Ø§Ø³Ø¨ Ø§Ù„Ø£ÙØ±Ø§Ø¯ ÙˆØ§Ù„Ù…Ø¬Ù…ÙˆØ¹Ø§Øª.",
        "en": "Embark on an extraordinary 8-day journey combining ancient Roman splendor, rich Islamic heritage, and the breathtaking beauty of the Sahara Desert. This curated program takes you from the vibrant capital of Tunis to the vast golden dunes of the south, offering a premium experience designed for all travel groups.",
        "es": "EmbÃ¡rquese en un viaje extraordinario de 8 dÃ­as que combina a la perfecciÃ³n la grandeza romana antigua, el rico legado islÃ¡mico y la belleza sobrecogedora del desierto del Sahara. Este programa seleccionado le llevarÃ¡ desde la vibrante capital de TÃºnez hasta las vastas dunas doradas del sur, ofreciendo una experiencia prÃ©mium diseÃ±ada para todo tipo de grupos.",
        "it": "Imbarcatevi in un viaggio straordinario di 8 giorni che unisce perfettamente l'antica grandezza romana, il ricco patrimonio islamico e la straordinaria bellezza del deserto del Sahara. Questo programma curato vi condurrÃ  dalla vivace capitale Tunisi fino alle vaste dune dorate del sud, offrendo un'esperienza premium pensata per ogni tipo di gruppo.",
        "pt": "Embarque em uma viagem extraordinÃ¡ria de 8 dias que combina perfeitamente a grandeza romana antiga, a rica heranÃ§a islÃ¢mica e a beleza deslumbrante do deserto do Saara. Este programa selecionado levarÃ¡ vocÃª da vibrante capital de TÃºnis Ã s vastas dunas douradas do sul, oferecendo uma experiÃªncia premium projetada para todos os tipos de grupos."
},
      includedServicesJsonb: {
        "ar": [
                "ØªØ°Ø§ÙƒØ± Ø§Ù„Ø·ÙŠØ±Ø§Ù† (ØªØ´Ù…Ù„ Ø­Ù‚ÙŠØ¨Ø© Ø´Ø­Ù† 23 ÙƒØ¬Ù… + Ø­Ù‚ÙŠØ¨Ø© ÙŠØ¯ ÙƒØ§Ø¨ÙŠÙ†Ø© 8 ÙƒØ¬Ù…)",
                "Ø§Ù„Ø§Ø³ØªÙ‚Ø¨Ø§Ù„ ÙˆØ§Ù„ØªÙˆØµÙŠÙ„ Ù…Ù† ÙˆØ¥Ù„Ù‰ Ø§Ù„Ù…Ø·Ø§Ø±",
                "Ø§Ù„Ø¬ÙˆÙ„Ø§Øª Ø§Ù„Ø¨Ø±ÙŠØ© Ø·ÙˆØ§Ù„ Ø§Ù„Ù€ 8 Ø£ÙŠØ§Ù… Ø¨Ø³ÙŠØ§Ø±Ø© Ø³ÙŠØ§Ø­ÙŠØ© Ù…Ø±ÙŠØ­Ø©",
                "Ù…Ø±Ø´Ø¯ Ø³ÙŠØ§Ø­ÙŠ Ù…Ø­ØªØ±Ù ÙŠØªØ­Ø¯Ø« Ø§Ù„Ù„ØºØªÙŠÙ† Ø§Ù„Ø¥Ø³Ø¨Ø§Ù†ÙŠØ©/Ø§Ù„Ù‚Ø´ØªØ§Ù„ÙŠØ©",
                "Ø§Ù„Ø¥Ù‚Ø§Ù…Ø© 7 Ù„ÙŠØ§Ù„Ù ÙÙŠ Ø§Ù„ÙÙ†Ø§Ø¯Ù‚ Ø§Ù„Ù…Ø°ÙƒÙˆØ±Ø© (4 Ùˆ 5 Ù†Ø¬ÙˆÙ…)",
                "7 ÙØ·ÙˆØ±ØŒ 6 ØºØ¯Ø§Ø¡ØŒ 6 Ø¹Ø´Ø§Ø¡",
                "Ø±Ø³ÙˆÙ… ØªØ°Ø§ÙƒØ± Ø¯Ø®ÙˆÙ„ Ø§Ù„Ù…Ø¹Ø§Ù„Ù… Ø§Ù„Ø³ÙŠØ§Ø­ÙŠØ© Ø§Ù„ØªØ§Ù„ÙŠØ©: (Ù‚ØµØ± Ø§Ù„Ø¬Ù…ØŒ Ù…Ø¹Ø§Ù„Ù… Ø§Ù„Ù‚ÙŠØ±ÙˆØ§Ù†ØŒ Ù‚Ø±Ø·Ø§Ø¬ØŒ Ø³Ø¨ÙŠØ·Ù„Ø©ØŒ Ø¯Ù‚Ø©ØŒ ÙˆÙ…ØªØ­Ù Ø¯Ø§Ø± Ø´Ø±ÙŠØ· ÙÙŠ ØªÙˆØ²Ø±)",
                "ØªØºØ·ÙŠØ© Ø§Ù„Ø²ÙŠØ§Ø±Ø§Øª Ù„Ù„Ù…Ø¯Ù† ÙˆØ§Ù„Ù‚Ø±Ù‰ Ø§Ù„Ù…Ø¯Ø±Ø¬Ø© Ø¨Ø§Ù„Ø¨Ø±Ù†Ø§Ù…Ø¬",
                "ØªØ£Ù…ÙŠÙ† Ø§Ù„Ø³ÙØ± Ø§Ù„Ø£Ø³Ø§Ø³ÙŠ"
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
                "Circuito de 8 dÃ­as en transporte turÃ­stico confortable",
                "GuÃ­a profesional en castellano",
                "Alojamiento de 7 noches en hoteles de 4* y 5*",
                "7 desayunos, 6 almuerzos, 6 cenas",
                "Entradas a los monumentos mencionados",
                "Visitas guiadas",
                "Seguro de inclusiÃ³n"
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
                "Voos incluÃ­dos com mala despachada de 23 kg + 1 mala de cabine de 8 kg",
                "AssistÃªncia e translados",
                "Circuito de 8 dias em transporte turÃ­stico confortÃ¡vel",
                "Guia profissional em espanhol",
                "AcomodaÃ§Ã£o de 7 noites em hotÃ©is de 4* e 5*",
                "7 cafÃ©s da manhÃ£, 6 almoÃ§os, 6 jantares",
                "Ingressos para os monumentos mencionados",
                "Visitas guiadas",
                "Seguro de viagem incluÃ­do"
        ]
},
      excludedServicesJsonb: {
        "ar": [
                "Ø§Ù„Ø¥ÙƒØ±Ø§Ù…ÙŠØ§Øª (Propinas)",
                "Ø§Ù„Ù…Ø´Ø±ÙˆØ¨Ø§Øª Ù…Ø¹ Ø§Ù„ÙˆØ¬Ø¨Ø§Øª",
                "Ø¶Ø±ÙŠØ¨Ø© Ø§Ù„Ø¥Ù‚Ø§Ù…Ø© Ø§Ù„ÙÙ†Ø¯Ù‚ÙŠØ© (Tasa de estancia)"
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
                "Taxa de estadia em hotÃ©is"
        ]
},
      itineraries: [
        {
                "dayLabel": "Day 1",
                "titleJsonb": {
                        "ar": "Ø§Ù„ÙŠÙˆÙ… Ø§Ù„Ø£ÙˆÙ„: ØªÙˆÙ†Ø³ Ø§Ù„Ø¹Ø§ØµÙ…Ø©",
                        "en": "DAY 1: TUNIS",
                        "es": "DÃA 1: TÃšNEZ",
                        "it": "GIORNO 1: TUNISI",
                        "pt": "DIA 1: TÃšNIS"
                },
                "descriptionJsonb": {
                        "ar": "Ø§Ù„Ø§Ø³ØªÙ‚Ø¨Ø§Ù„ ÙÙŠ Ø§Ù„Ù…Ø·Ø§Ø± ÙˆØ§Ù„Ø§Ù†ØªÙ‚Ø§Ù„ Ø¥Ù„Ù‰ ÙÙ†Ø¯Ù‚ 4 Ù†Ø¬ÙˆÙ…. (Ø§Ù„Ù…Ø¨ÙŠØª ÙÙŠ ØªÙˆÙ†Ø³).",
                        "en": "Assistance and transfer to a 4* Hotel. Accommodation.",
                        "es": "Asistencia y traslado al Hotel 4*. Alojamiento.",
                        "it": "Assistenza e trasferimento all'Hotel 4*. Pernottamento.",
                        "pt": "AssistÃªncia e translado para o Hotel 4*. AcomodaÃ§Ã£o."
                },
                "mealsJsonb": {
                        "ar": "Ù„Ø§ ÙŠÙˆØ¬Ø¯ ÙˆØ¬Ø¨Ø§Øª",
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
                        "ar": "Ø§Ù„ÙŠÙˆÙ… Ø§Ù„Ø«Ø§Ù†ÙŠ: ØªÙˆÙ†Ø³ - Ø§Ù„Ù…Ø¯ÙŠÙ†Ø© Ø§Ù„Ø¹ØªÙŠÙ‚Ø© - Ù‚Ø±Ø·Ø§Ø¬ - Ø³ÙŠØ¯ÙŠ Ø¨ÙˆØ³Ø¹ÙŠØ¯ - Ø§Ù„Ø­Ù…Ø§Ù…Ø§Øª",
                        "en": "DAY 2: TUNIS - MEDINA - CARTHAGE - SIDI BOU SAID - HAMMAMET",
                        "es": "DÃA 2: TÃšNEZ - MEDINA - CARTAGO - SIDI BOU SAID - HAMMAMET",
                        "it": "GIORNO 2: TUNISI - MEDINA - CARTAGINE - SIDI BOU SAID - HAMMAMET",
                        "pt": "DIA 2: TÃšNIS - MEDINA - CARTAGO - SIDI BOU SAID - HAMMAMET"
                },
                "descriptionJsonb": {
                        "ar": "Ø§Ù„Ø£Ù†Ø´Ø·Ø©: Ø²ÙŠØ§Ø±Ø© Ø§Ù„Ù…Ø¯ÙŠÙ†Ø© Ø§Ù„Ø¹ØªÙŠÙ‚Ø© (Ø§Ù„Ù…ØµÙ†ÙØ© ÙŠÙˆÙ†Ø³ÙƒÙˆ) ÙˆØ§Ù„ØªØ¬ÙˆÙ„ ÙÙŠ Ø£Ø³ÙˆØ§Ù‚Ù‡Ø§ Ø§Ù„Ø­Ø±ÙÙŠØ©. Ø«Ù… Ø§Ù„ØªÙˆØ¬Ù‡ Ø¥Ù„Ù‰ Ù‚Ø±Ø·Ø§Ø¬ ÙˆØ²ÙŠØ§Ø±Ø© Ø­Ù…Ø§Ù…Ø§Øª Ø£Ù†Ø·ÙˆÙ†ÙŠÙˆØ³ Ø¹Ù„Ù‰ Ø§Ù„Ø¨Ø­Ø±. Ø§Ù„Ø§Ù†ØªÙ‚Ø§Ù„ Ø¥Ù„Ù‰ Ù‚Ø±ÙŠØ© Ø³ÙŠØ¯ÙŠ Ø¨ÙˆØ³Ø¹ÙŠØ¯ ÙˆØ§Ù„ØªØ¬ÙˆÙ„ ÙÙŠ Ø´ÙˆØ§Ø±Ø¹Ù‡Ø§.",
                        "en": "Activities: Departure to the Medina of Tunis (UNESCO World Heritage Site). Walk through the traditional guild-organized souks. Lunch. Departure to Carthage, ancient capital of the Carthaginian empire. Visit the Baths of Antoninus facing the Mediterranean Sea. Continue to the Moorish village of Sidi Bou Said for a walk. Departure to Hammamet. Arrival at 5* Hotel. Dinner and accommodation.",
                        "es": "Actividades: Salida hacia la medina de TÃºnez (Patrimonio de la Humanidad por la UNESCO). Caminaremos por los zocos organizados de forma gremial. Almuerzo. Salida hacia Cartago, antigua capital del imperio cartaginÃ©s. Visita de las termas de Antonino frente al mar MediterrÃ¡neo. ContinuaciÃ³n hacia el pueblo morisco de Sidi Bou Said y paseo por sus calles. Salida hacia Hammamet. Llegada al Hotel 5*. Cena y alojamiento.",
                        "it": "AttivitÃ : Partenza per la Medina di Tunisi (Patrimonio dell'UmanitÃ  UNESCO). Passeggiata tra i souk tradizionali organizzati in corporazioni. Pranzo. Partenza per Cartagine, antica capitale dell'impero cartaginese. Visita alle Terme di Antonino di fronte al Mar Mediterraneo. Proseguimento per il villaggio moresco di Sidi Bou Said e passeggiata. Partenza per Hammamet. Arrivo in Hotel 5*. Cena e pernottamento.",
                        "pt": "Atividades: Partida para a Medina de TÃºnis (PatrimÃ´nio Mundial da UNESCO). Caminhada pelos souks tradicionais organizados por corporaÃ§Ãµes de ofÃ­cio. AlmoÃ§o. Partida para Cartago, antiga capital do impÃ©rio cartaginÃªs. Visita Ã s Termas de Antonino em frente ao Mar MediterrÃ¢neo. ContinuaÃ§Ã£o para a vila mourisca de Sidi Bou Said e passeio pelas suas ruas. Partida para Hammamet. Chegada ao Hotel 5*. Jantar e acomodaÃ§Ã£o."
                },
                "mealsJsonb": {
                        "ar": "ÙØ·ÙˆØ± + ØºØ¯Ø§Ø¡ + Ø¹Ø´Ø§Ø¡",
                        "en": "Breakfast + Lunch + Dinner",
                        "es": "Desayuno + Almuerzo + Cena",
                        "it": "Colazione + Pranzo + Cena",
                        "pt": "CafÃ© da manhÃ£ + AlmoÃ§o + Jantar"
                },
                "sortOrder": 1
        },
        {
                "dayLabel": "Day 3",
                "titleJsonb": {
                        "ar": "Ø§Ù„ÙŠÙˆÙ… Ø§Ù„Ø«Ø§Ù„Ø«: Ø§Ù„Ø­Ù…Ø§Ù…Ø§Øª - ØªØ³ØªÙˆØ± - Ø¯Ù‚Ø© (Dougga) - Ø§Ù„Ø­Ù…Ø§Ù…Ø§Øª",
                        "en": "DAY 3: HAMMAMET - TESTOUR - DOUGGA - HAMMAMET",
                        "es": "DÃA 3: HAMMAMET - TESTOUR - DOUGGA - HAMMAMET",
                        "it": "GIORNO 3: HAMMAMET - TESTOUR - DOUGGA - HAMMAMET",
                        "pt": "DIA 3: HAMMAMET - TESTOUR - DOUGGA - HAMMAMET"
                },
                "descriptionJsonb": {
                        "ar": "Ø§Ù„Ø£Ù†Ø´Ø·Ø©: Ø²ÙŠØ§Ø±Ø© Ø¨Ù„Ø¯Ø© 'ØªØ³ØªÙˆØ±' Ø§Ù„Ø£Ù†Ø¯Ù„Ø³ÙŠØ©ØŒ Ø«Ù… Ø§Ù„ØªÙˆØ¬Ù‡ Ø¥Ù„Ù‰ Ø¢Ø«Ø§Ø± 'Ø¯Ù‚Ø©' Ø§Ù„Ø±ÙˆÙ…Ø§Ù†ÙŠØ© (Ø§Ù„Ù…ØµÙ†ÙØ© ÙŠÙˆÙ†Ø³ÙƒÙˆ) ÙˆØ²ÙŠØ§Ø±Ø© Ø§Ù„Ù…Ø³Ø±Ø­ØŒ ÙƒÙ†ÙŠØ³Ø© Ø§Ù„Ù†ØµØ±ØŒ Ø§Ù„Ø­Ù…Ø§Ù…Ø§ØªØŒ ÙˆØ§Ù„Ù…Ù‚Ø§Ø¨Ø± Ø§Ù„Ø±ÙˆÙ…Ø§Ù†ÙŠØ© (Ø§Ù„Ù…Ø±ØªØ¨Ø·Ø© Ø¨ØªØ§Ø±ÙŠØ® Ø§Ù„Ù‚Ø¯ÙŠØ³ Ø£ØºØ³Ø·ÙŠÙ†ÙˆØ³).",
                        "en": "Activities: Departure to the Ruins of Thugga (modern-day Dougga). Stop in Testour to walk through this medieval village founded by Andalusian Moriscos in the 16th century. Continue to Dougga to visit the most important Roman ruins in Africa (UNESCO World Heritage). Visit the theater, the Church of Victoria, the baths, houses, and temples. Lunch and return to Hammamet. Arrival at 5* Hotel. Dinner and accommodation.",
                        "es": "Actividades: Salida hacia las Ruinas de Thugga (la actual Dougga). Parada en Testur para pasear por este pueblo medieval fundado por los primeros mudÃ©jares en el siglo XVI. ContinuaciÃ³n hacia Dougga, donde visitaremos las ruinas mÃ¡s importantes de Ãfrica (Patrimonio de la Humanidad). Visita del teatro, la iglesia de la Victoria, las termas, las casas y los templos. Almuerzo y regreso a Hammamet. Llegada al Hotel 5*. Cena y alojamiento.",
                        "it": "AttivitÃ : Partenza per le Rovine di Thugga (l'attuale Dougga). Sosta a Testour per una passeggiata in questo villaggio medievale fondato dai moriscos andalusi nel XVI secolo. Proseguimento per Dougga, dove visiteremo le ruine romane piÃ¹ importanti d'Africa (Patrimonio UNESCO). Visita del teatro, della Chiesa della Vittoria, delle terme, delle case e dei templi. Pranzo e rientro a Hammamet. Arrivo in Hotel 5*. Cena e pernottamento.",
                        "pt": "Atividades: Partida para as RuÃ­nas de Thugga (atual Dougga). Parada em Testour para caminhar por esta vila medieval fundada pelos mouriscos andaluzes no sÃ©culo XVI. ContinuaÃ§Ã£o para Dougga, onde visitaremos as ruÃ­nas romanas mais importantes da Ãfrica (PatrimÃ´nio Mundial). Visita ao teatro, Ã  Igreja da VitÃ³ria, Ã s termas, Ã s casas e aos templos. AlmoÃ§o e retorno para Hammamet. Chegada ao Hotel 5*. Jantar e acomodaÃ§Ã£o."
                },
                "mealsJsonb": {
                        "ar": "ÙØ·ÙˆØ± + ØºØ¯Ø§Ø¡ + Ø¹Ø´Ø§Ø¡",
                        "en": "Breakfast + Lunch + Dinner",
                        "es": "Desayuno + Almuerzo + Cena",
                        "it": "Colazione + Pranzo + Cena",
                        "pt": "CafÃ© da manhÃ£ + AlmoÃ§o + Jantar"
                },
                "sortOrder": 2
        },
        {
                "dayLabel": "Day 4",
                "titleJsonb": {
                        "ar": "Ø§Ù„ÙŠÙˆÙ… Ø§Ù„Ø±Ø§Ø¨Ø¹: Ø§Ù„Ø­Ù…Ø§Ù…Ø§Øª - Ø§Ù„Ø¬Ù… - Ù…Ø·Ù…Ø§Ø·Ø© - Ø¯ÙˆØ²",
                        "en": "DAY 4: HAMMAMET - EL JEM - MATMATA - DOUZ",
                        "es": "DÃA 4: HAMMAMET - EL JEM - MATMATA - DOUZ",
                        "it": "GIORNO 4: HAMMAMET - EL JEM - MATMATA - DOUZ",
                        "pt": "DIA 4: HAMMAMET - EL JEM - MATMATA - DOUZ"
                },
                "descriptionJsonb": {
                        "ar": "Ø§Ù„Ø£Ù†Ø´Ø·Ø©: Ø²ÙŠØ§Ø±Ø© Ù‚ØµØ± Ø§Ù„Ø¬Ù… (Ø§Ù„Ù…Ø³Ø±Ø­ Ø§Ù„Ø±ÙˆÙ…Ø§Ù†ÙŠ Ø§Ù„Ø«Ø§Ù„Ø« Ø¹Ø§Ù„Ù…ÙŠØ§Ù‹). Ø§Ù„ØªØ­Ø±Ùƒ Ù†Ø­Ùˆ 'Ù…Ø·Ù…Ø§Ø·Ø©' Ù„Ø±Ø¤ÙŠØ© Ø§Ù„Ø¨ÙŠÙˆØª Ø§Ù„Ø¨Ø±Ø¨Ø±ÙŠØ© Ø§Ù„Ù…Ø­ÙÙˆØ±Ø© ØªØ­Øª Ø§Ù„Ø£Ø±Ø¶ (Ù…ÙˆÙ‚Ø¹ ØªØµÙˆÙŠØ± ÙÙŠÙ„Ù… Star Wars). Ø§Ù„Ù…Ø±ÙˆØ± Ø¨Ø¨Ù„Ø¯Ø© 'ØªØ§Ù…Ø±Ø²Øª' Ø§Ù„Ø¨Ø§Ù†ÙˆØ±Ø§Ù…ÙŠØ©. Ø§Ù„ÙˆØµÙˆÙ„ Ø¥Ù„Ù‰ 'Ø¯ÙˆØ²' (Ø¨ÙˆØ§Ø¨Ø© Ø§Ù„ØµØ­Ø±Ø§Ø¡) Ù„Ø¹Ù…Ù„ Ø¬ÙˆÙ„Ø© Ø¹Ù„Ù‰ Ø±ÙƒÙˆØ¨ Ø§Ù„Ø¬Ù…Ø§Ù„ ÙÙŠ Ø§Ù„ÙƒØ«Ø¨Ø§Ù† Ø§Ù„Ø±Ù…Ù„ÙŠØ©.",
                        "en": "Activities: Departure to El Jem to visit the Roman amphitheater (3rd largest in the world). Continue to Matmata, the Berber stronghold in the Dahir mountains, famous for its unique underground Troglodyte houses (where Star Wars exterior scenes were filmed). Panoramic stop and lunch in Tamerzet. Continue to Douz, the gateway to the desert. Camel trekking excursion in the dunes. Arrival at 4* Hotel. Dinner and accommodation.",
                        "es": "Actividades: Salida hacia El Jem, visita del anfiteatro romano (el tercero del mundo). ContinuaciÃ³n hacia Matmata, bastiÃ³n de los pueblos bereberes en la cadena de Dahir, con sus famosas casas trogloditas donde se rodÃ³ la Guerra de las Galaxias. Parada panorÃ¡mica y almuerzo en Tamerzet. ContinuaciÃ³n hacia Douz, la puerta del desierto. ExcursiÃ³n a lomo de dromedario en las dunas. Regreso al Hotel 4*. Cena y alojamiento.",
                        "it": "AttivitÃ : Partenza per El Jem, visita dell'anfiteatro romano (il terzo piÃ¹ grande al mondo). Proseguimento per Matmata, l'ultimo bastione berbero sulle montagne del Dahir, famoso per le case troglodite sotterranee (set di Star Wars). Sosta panoramica e pranzo a Tamerzet. Proseguimento per Douz, la porta del deserto. Escursione a dorso di dromedario tra le dune di sabbia. Arrivo in Hotel 4*. Cena e pernottamento.",
                        "pt": "Atividades: Partida para El Jem, visita ao anfiteatro romano (o terceiro maior do mundo). ContinuaÃ§Ã£o para Matmata, o Ãºltimo reduto dos povos berberes nas montanhas de Dahir, famoso por suas casas trogloditas subterrÃ¢neas (onde foram filmadas cenas de Star Wars). Parada panorÃ¢mica e almoÃ§o em Tamerzet. ContinuaÃ§Ã£o para Douz, a porta do deserto. ExcursÃ£o a camelo nas dunas de areia. Chegada ao Hotel 4*. Jantar e acomodaÃ§Ã£o."
                },
                "mealsJsonb": {
                        "ar": "ÙØ·ÙˆØ± + ØºØ¯Ø§Ø¡ + Ø¹Ø´Ø§Ø¡",
                        "en": "Breakfast + Lunch + Dinner",
                        "es": "Desayuno + Almuerzo + Cena",
                        "it": "Colazione + Pranzo + Cena",
                        "pt": "CafÃ© da manhÃ£ + AlmoÃ§o + Jantar"
                },
                "sortOrder": 3
        },
        {
                "dayLabel": "Day 5",
                "titleJsonb": {
                        "ar": "Ø§Ù„ÙŠÙˆÙ… Ø§Ù„Ø®Ø§Ù…Ø³: Ø¯ÙˆØ² - Ø´Ø· Ø§Ù„Ø¬Ø±ÙŠØ¯ - ØªÙˆØ²Ø±",
                        "en": "DAY 5: DOUZ - CHOTT EL JERID - TOZEUR",
                        "es": "DÃA 5: DOUZ - CHOTT EL JERID - TOZEUR",
                        "it": "DOUS - CHOTT EL JERID - TOZEUR",
                        "pt": "DIA 5: DOUZ - CHOTT EL JERID - TOZEUR"
                },
                "descriptionJsonb": {
                        "ar": "Ø§Ù„Ø£Ù†Ø´Ø·Ø©: Ø¹Ø¨ÙˆØ± Ø¨Ø­ÙŠØ±Ø© Ø§Ù„Ù…Ù„Ø­ Ø§Ù„Ø¬Ø§ÙØ© 'Ø´Ø· Ø§Ù„Ø¬Ø±ÙŠØ¯' Ø¨Ø§Ù„Ø³ÙŠØ§Ø±Ø© ÙˆÙ…Ø´Ø§Ù‡Ø¯Ø© Ø¸Ø§Ù‡Ø±Ø© Ø§Ù„Ø³Ø±Ø§Ø¨ ÙˆØªØºÙŠØ± Ø£Ù„ÙˆØ§Ù† Ø§Ù„Ù…ÙŠØ§Ù‡. Ø§Ù„ÙˆØµÙˆÙ„ Ø¥Ù„Ù‰ ØªÙˆØ²Ø± ÙˆØ²ÙŠØ§Ø±Ø© Ù…ØªØ­Ù 'Ø¯Ø§Ø± Ø´Ø±ÙŠØ·' ÙˆÙ…ØªØ­Ù Ø§Ù„ØªÙ…ÙˆØ±.",
                        "en": "Activities: Cross the Chott el Jerid salt lake by road, witnessing the shifting water colors and mirages. Continue to Tozeur. Arrival and check-in at 4* Hotel. Lunch. In the afternoon, visit the Dar Chraiet Museum and the Date Museum. Dinner and accommodation.",
                        "es": "Actividades: Salida hacia el desierto cruzando por carretera el lago salado Chott el Jerid, observando los distintos colores de sus aguas y el espejismo. ContinuaciÃ³n hacia Tozeur. Llegada y alojamiento en Hotel 4*. Almuerzo. Por la tarde, visita del museo de Dar Chraiet y el Museo de los DÃ¡tiles. Cena y alojamiento.",
                        "it": "AttivitÃ : Partenza per il deserto attraversando il lago salato Chott el Jerid, ammirando i colori cangianti dell'acqua e i miraggi. Proseguimento per Tozeur. Arrivo e sistemazione in Hotel 4*. Pranzo. Nel pomeriggio, visita del Museo Dar Chraiet e del Museo dei Datteri. Cena e pernottamento.",
                        "pt": "Atividades: Partida em direÃ§Ã£o ao deserto atravessando o lago salgado Chott el Jerid por estrada, observando as cores mutÃ¡veis da Ã¡gua e as miragens. ContinuaÃ§Ã£o para Tozeur. Chegada e acomodaÃ§Ã£o em Hotel 4*. AlmoÃ§o. Ã€ tarde, visita ao Museu Dar Chraiet e ao Museu das TÃ¢maras. Jantar e acomodaÃ§Ã£o."
                },
                "mealsJsonb": {
                        "ar": "ÙØ·ÙˆØ± + ØºØ¯Ø§Ø¡ + Ø¹Ø´Ø§Ø¡",
                        "en": "Breakfast + Lunch + Dinner",
                        "es": "Desayuno + Almuerzo + Cena",
                        "it": "Colazione + Pranzo + Cena",
                        "pt": "CafÃ© da manhÃ£ + AlmoÃ§o + Jantar"
                },
                "sortOrder": 4
        },
        {
                "dayLabel": "Day 6",
                "titleJsonb": {
                        "ar": "Ø§Ù„ÙŠÙˆÙ… Ø§Ù„Ø³Ø§Ø¯Ø³: ØªÙˆØ²Ø±",
                        "en": "DAY 6: TOZEUR",
                        "es": "DÃA 6: TOZEUR",
                        "it": "GIORNO 6: TOZEUR",
                        "pt": "DIA 6: TOZEUR"
                },
                "descriptionJsonb": {
                        "ar": "Ø§Ù„Ø£Ù†Ø´Ø·Ø©: Ø¬ÙˆÙ„Ø© ØµØ¨Ø§Ø­ÙŠØ© ÙÙŠ Ø§Ù„Ù…Ø¯ÙŠÙ†Ø© Ø§Ù„Ù‚Ø¯ÙŠÙ…Ø© ÙˆØ³ÙˆÙ‚ ØªÙˆØ²Ø±. ÙØªØ±Ø© Ø¨Ø¹Ø¯ Ø§Ù„Ø¸Ù‡Ø± Ø­Ø±Ø©ØŒ Ù…Ø¹ Ø¥Ù…ÙƒØ§Ù†ÙŠØ© Ø¹Ù…Ù„ (Ø±Ø­Ù„Ø© Ø§Ø®ØªÙŠØ§Ø±ÙŠØ© Ø¨Ø³ÙŠØ§Ø±Ø§Øª 4x4) Ø¥Ù„Ù‰ Ø§Ù„ÙˆØ§Ø­Ø§Øª Ø§Ù„Ø¬Ø¨Ù„ÙŠØ© (Ø´Ø¨ÙŠÙƒØ© ÙˆØªÙ…ØºØ²Ø©) ÙˆÙ…ÙˆØ§Ù‚Ø¹ ØªØµÙˆÙŠØ± Ø§Ù„Ø£ÙÙ„Ø§Ù… (The English Patient & Star Wars) ÙÙŠ 'Ø¹Ù†Ù‚ Ø§Ù„Ø¬Ù…Ù„'.",
                        "en": "Activities: Morning visit to the old city and the Souk of Tozeur. Lunch at the hotel. Afternoon at leisure or optional 4x4 excursion to the mountain oases of Chebika, Tamerza, and the desert dunes of Ong Jmel (filming site of The English Patient and Star Wars). Dinner and accommodation at 4* Hotel.",
                        "es": "Actividades: Por la maÃ±ana, visita de la ciudad antigua y el Souk de Tozeur. Almuerzo en el hotel. Por la tarde, posibilidad de realizar una excursiÃ³n opcional en 4x4 a los oasis de montaÃ±a (Chebika, Tamerza) y a las pistas de ONG Jmel (El paciente inglÃ©s y La guerra de las galaxias). Regreso al Hotel 4*. Cena y alojamiento.",
                        "it": "AttivitÃ : Mattinata dedicata alla visita della cittÃ  vecchia e del Souk di Tozeur. Pranzo in hotel. Pomeriggio libero o escursione facoltativa in 4x4 alle oasi di montagna (Chebika, Tamerza) e alle dune di Ong Jmel (set di Il Paziente Inglese e Star Wars). Cena e pernottamento in Hotel 4*.",
                        "pt": "Atividades: Pela manhÃ£, visita Ã  cidade antiga e ao Souk de Tozeur. AlmoÃ§o no hotel. Ã€ tarde, possibilidade de realizar uma excursÃ£o opcional em 4x4 aos oÃ¡sis de montanha (Chebika, Tamerza) e Ã s pistas de Ong Jmel (cenÃ¡rio de O Paciente InglÃªs e Star Wars). Retorno ao Hotel 4*. Jantar e acomodaÃ§Ã£o."
                },
                "mealsJsonb": {
                        "ar": "ÙØ·ÙˆØ± + ØºØ¯Ø§Ø¡ + Ø¹Ø´Ø§Ø¡",
                        "en": "Breakfast + Lunch + Dinner",
                        "es": "Desayuno + Almuerzo + Cena",
                        "it": "Colazione + Pranzo + Cena",
                        "pt": "CafÃ© da manhÃ£ + AlmoÃ§o + Jantar"
                },
                "sortOrder": 5
        },
        {
                "dayLabel": "Day 7",
                "titleJsonb": {
                        "ar": "Ø§Ù„ÙŠÙˆÙ… Ø§Ù„Ø³Ø§Ø¨Ø¹: ØªÙˆØ²Ø± - Ø§Ù„Ù‚ÙŠØ±ÙˆØ§Ù† - Ø§Ù„Ø­Ù…Ø§Ù…Ø§Øª",
                        "en": "DAY 7: TOZEUR - KAIROUAN - HAMMAMET",
                        "es": "DÃA 7: TOZEUR - KAIROUAN - HAMMAMET",
                        "it": "GIORNO 7: TOZEUR - KAIROUAN - HAMMAMET",
                        "pt": "DIA 7: TOZEUR - KAIROUAN - HAMMAMET"
                },
                "descriptionJsonb": {
                        "ar": "Ø§Ù„Ø£Ù†Ø´Ø·Ø©: Ø§Ù„ØªÙˆØ¬Ù‡ Ø¥Ù„Ù‰ Ø§Ù„Ù‚ÙŠØ±ÙˆØ§Ù† ÙˆØ²ÙŠØ§Ø±Ø© Ø¬Ø§Ù…Ø¹ Ø¹Ù‚Ø¨Ø© Ø¨Ù† Ù†Ø§ÙØ¹ Ø§Ù„ÙƒØ¨ÙŠØ± ÙˆÙ…Ù‚Ø§Ù… Ø£Ø¨ÙŠ Ø²Ù…Ø¹Ø© Ø§Ù„Ø¨Ù„ÙˆÙŠ (Ù…Ù‚Ø§Ù… Ø§Ù„ØµØ­Ø§Ø¨ÙŠ/Ø§Ù„Ø­Ù„Ø§Ù‚). Ø¬ÙˆÙ„Ø© ÙÙŠ Ø§Ù„Ù…Ø¯ÙŠÙ†Ø© Ø§Ù„Ø¹ØªÙŠÙ‚Ø© Ø«Ù… Ø§Ù„Ø§Ù†ØªÙ‚Ø§Ù„ Ø¥Ù„Ù‰ Ø§Ù„Ø­Ù…Ø§Ù…Ø§Øª.",
                        "en": "Activities: Departure to Kairouan. Visit the Great Mosque of Sidi Oqba and the Mausoleum of the Barber (Sidi Sahbi). Lunch. Walk through the ancient medina and departure to Hammamet. Arrival at 5* Hotel. Dinner and accommodation.",
                        "es": "Actividades: Salida hacia Kairouan. Llegada y visita de la Gran Mezquita de Sidi Oqba y del mausoleo del barbero (Sidi Sahbi). Almuerzo. Paseo por su medina antigua y salida hacia Hammamet. Llegada al Hotel 5*. Cena y alojamiento.",
                        "it": "AttivitÃ : Partenza per Kairouan. Visita della Grande Moschea di Sidi Oqba e del Mausoleo del Barbiere (Sidi Sahbi). Pranzo. Passeggiata nella medina antica e partenza per Hammamet. Arrivo in Hotel 5*. Cena e pernottamento.",
                        "pt": "Atividades: Partida para Kairouan. Chegada e visita Ã  Grande Mesquita de Sidi Oqba e ao MausolÃ©u do Barbeiro (Sidi Sahbi). AlmoÃ§o. Passeio pela medina antiga e partida para Hammamet. Chegada ao Hotel 5*. Jantar e acomodaÃ§Ã£o."
                },
                "mealsJsonb": {
                        "ar": "ÙØ·ÙˆØ± + ØºØ¯Ø§Ø¡ + Ø¹Ø´Ø§Ø¡",
                        "en": "Breakfast + Lunch + Dinner",
                        "es": "Desayuno + Almuerzo + Cena",
                        "it": "Colazione + Pranzo + Cena",
                        "pt": "CafÃ© da manhÃ£ + AlmoÃ§o + Jantar"
                },
                "sortOrder": 6
        },
        {
                "dayLabel": "Day 8",
                "titleJsonb": {
                        "ar": "Ø§Ù„ÙŠÙˆÙ… Ø§Ù„Ø«Ø§Ù…Ù†: Ø§Ù„Ø­Ù…Ø§Ù…Ø§Øª - ØªÙˆÙ†Ø³ Ø§Ù„Ø¹Ø§ØµÙ…Ø©",
                        "en": "DAY 8: HAMMAMET - TUNIS",
                        "es": "DÃA 8: HAMMAMET - TÃšNEZ",
                        "it": "GIORNO 8: HAMMAMET - TUNISI",
                        "pt": "DIA 8: HAMMAMET - TÃšNIS"
                },
                "descriptionJsonb": {
                        "ar": "Ø§Ù„Ø£Ù†Ø´Ø·Ø©: ÙˆÙ‚Øª Ø­Ø± Ø­ØªÙ‰ Ù…ÙˆØ¹Ø¯ Ø§Ù„ØªØ­Ø±ÙƒØŒ Ø«Ù… Ø§Ù„Ø§Ù†ØªÙ‚Ø§Ù„ Ø¥Ù„Ù‰ Ù…Ø·Ø§Ø± ØªÙˆÙ†Ø³ Ù„Ù„Ù…ØºØ§Ø¯Ø±Ø© ÙˆØ§Ù„Ø¹ÙˆØ¯Ø©.",
                        "en": "Activities: Free time until the scheduled transfer to Tunis airport for check-in and departure flight.",
                        "es": "Actividades: Tiempo libre hasta la hora prevista, traslado al aeropuerto de TÃºnez para trÃ¡mites de facturaciÃ³n y embarque.",
                        "it": "AttivitÃ : Tempo libero fino al trasferimento programmato all'aeroporto di Tunisi per il volo di ritorno.",
                        "pt": "Atividades: Tempo livre atÃ© o horÃ¡rio programado, translado para o aeroporto de TÃºnis para os procedimentos de check-in e embarque."
                },
                "mealsJsonb": {
                        "ar": "ÙØ·ÙˆØ±",
                        "en": "Breakfast",
                        "es": "Desayuno",
                        "it": "Colazione",
                        "pt": "CafÃ© da manhÃ£"
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
        ar: 'Ø§Ù„Ø£ÙØ¶Ù„ ÙÙŠ Ø§Ù„ÙŠÙˆÙ†Ø§Ù† â€“ 09 Ø£ÙŠØ§Ù…',
        en: 'Best of Greece â€“ 09 Days',
        es: 'Lo Mejor de Grecia â€“ 09 DÃ­as',
        it: 'Il Meglio della Grecia â€“ 09 Giorni',
        pt: 'O Melhor da GrÃ©cia â€“ 09 Dias',
      },
      category: 'Greece',
      country: 'Greece',
      city: 'Athens',
      basePriceUsd: 1490,
      durationJsonb: {
        ar: '09 Ø£ÙŠØ§Ù… / 08 Ù„ÙŠØ§Ù„Ù',
        en: '09 Days / 08 Nights',
        es: '09 DÃ­as / 08 Noches',
        it: '09 Giorni / 08 Notti',
        pt: '09 Dias / 08 Noites',
      },
      minPaxJsonb: {
        ar: 'ÙØ±Ø¯Ø§Ù†',
        en: '2 Pax',
        es: '2 Pax',
        it: '2 Pax',
        pt: '2 Pax',
      },
      overviewJsonb: {
        ar: 'Ø§Ù†ØºÙ…Ø³ ÙÙŠ Ø±ÙˆØ¹Ø© Ø§Ù„ÙŠÙˆÙ†Ø§Ù† Ø§Ù„Ù‚Ø¯ÙŠÙ…Ø© ÙˆØ³Ø­Ø± Ø§Ù„Ø¨Ø­Ø± Ø¥ÙŠØ¬Ø© ÙÙŠ Ù‡Ø°Ø§ Ø§Ù„Ù…Ø³Ø§Ø± Ø§Ù„Ø±Ø§Ø¦Ø¹ Ø§Ù„Ù…Ù…ØªØ¯ Ù„ØªØ³Ø¹Ø© Ø£ÙŠØ§Ù…. Ù…Ù† Ø§Ù„Ø£ÙƒØ±ÙˆØ¨ÙˆÙ„ÙŠØ³ ÙÙŠ Ø£Ø«ÙŠÙ†Ø§ Ø¥Ù„Ù‰ ØºØ±ÙˆØ¨ Ø§Ù„Ø´Ù…Ø³ Ø§Ù„Ø³Ø§Ø­Ø± ÙÙŠ Ø³Ø§Ù†ØªÙˆØ±ÙŠÙ†ÙŠ ÙˆÙ…ÙŠÙƒÙˆÙ†ÙˆØ³ØŒ Ù…Ø±ÙˆØ±Ø§Ù‹ Ø¨Ø·Ø¨ÙŠØ¹Ø© ÙˆÙ…Ø£ÙƒÙˆÙ„Ø§Øª Ø¬Ø²ÙŠØ±Ø© ÙƒØ±ÙŠØª Ø§Ù„Ø®Ù„Ø§Ø¨Ø© ÙˆØªØ§Ø±ÙŠØ®Ù‡Ø§ Ø§Ù„Ù…ÙŠÙ†ÙˆÙŠ Ø§Ù„Ø¹Ø±ÙŠÙ‚ØŒ ØªØ¯Ù…Ø¬ Ù‡Ø°Ù‡ Ø§Ù„Ø±Ø­Ù„Ø© Ø¨ÙŠÙ† Ø§Ù„Ø«Ù‚Ø§ÙØ© Ø§Ù„ÙƒÙ„Ø§Ø³ÙŠÙƒÙŠØ© ÙˆØ±ÙˆØ¹Ø© Ø§Ù„Ø¨Ø­Ø± Ø§Ù„Ø£Ø¨ÙŠØ¶ Ø§Ù„Ù…ØªÙˆØ³Ø·.',
        en: 'Immerse yourself in the splendor of Ancient Greece and the charm of the Aegean Sea on this spectacular nine-day itinerary. From the grand Acropolis of Athens to the vibrant sunsets in Santorini and Mykonos, each stop reveals a piece of paradise and culture. Crowned with authentic gastronomy and Minoan history in Crete, this journey combines classical culture with pure Mediterranean essence.',
        es: 'SumÃ©rgete en el esplendor de la Antigua Grecia y el encanto del mar Egeo en este espectacular itinerario de nueve dÃ­as. Desde la grandiosa AcrÃ³polis de Atenas hasta los vibrantes atardeceres en Santorini y Mykonos, cada escala revela un pedazo de paraÃ­so y cultura. Coronando la travesÃ­a con la autÃ©ntica gastronomÃ­a e historia minoica en Creta, este viaje combina cultura clÃ¡sica y pura esencia mediterrÃ¡nea.',
        it: "Immergiti nello splendore dell'Antica Grecia e nel fascino del Mar Egeo in questo spettacolare itinerario di nove giorni. Dalla grandiosa Acropoli di Atene ai vibranti tramonti di Santorini e Mykonos, ogni tappa rivela un pezzo di paradiso e cultura. Coronando il viaggio con l'autentica gastronomia e la storia minoica a Creta, questo viaggio unisce la cultura classica alla pura essenza mediterranea.",
        pt: 'Mergulhe no esplendor da GrÃ©cia Antiga e no encanto do Mar Egeu neste espetacular itinerÃ¡rio de nove dias. Da grandiosa AcrÃ³pole de Atenas aos vibrantes por do sol em Santorini e Mykonos, cada parada revela um pedaÃ§o do paraÃ­so e da cultura. Coroando a viagem com a autÃªntica gastronomia e histÃ³ria minÃ³ica em Creta, esta viagem combina cultura clÃ¡ssica e pura essÃªncia mediterrÃ¢nea.',
      },
      includedServicesJsonb: {
        "ar": [
                "Ù„ÙŠÙ„ØªØ§Ù† ÙÙŠ Ø£Ø«ÙŠÙ†Ø§ØŒ Ù„ÙŠÙ„ØªØ§Ù† ÙÙŠ Ù…ÙŠÙƒÙˆÙ†ÙˆØ³ØŒ Ù„ÙŠÙ„ØªØ§Ù† ÙÙŠ Ø³Ø§Ù†ØªÙˆØ±ÙŠÙ†ÙŠ ÙˆÙ„ÙŠÙ„ØªØ§Ù† ÙÙŠ ÙƒØ±ÙŠØª Ù…Ø¹ Ø§Ù„Ø¥ÙØ·Ø§Ø±",
                "Ø¬ÙˆÙ„Ø© Ø³ÙŠØ§Ø­ÙŠØ© ÙÙŠ Ù…Ø¯ÙŠÙ†Ø© Ø£Ø«ÙŠÙ†Ø§ Ù†ØµÙ ÙŠÙˆÙ… (Ø¨Ø§Øµ Ù…Ø´ØªØ±Ùƒ) Ù…Ø¹ Ù…Ø±Ø´Ø¯ Ù…Ø­ØªØ±Ù ÙŠØªØ­Ø¯Ø« Ø§Ù„Ø¥Ø³Ø¨Ø§Ù†ÙŠØ©",
                "Ø¬Ù…ÙŠØ¹ ÙˆØ³Ø§Ø¦Ù„ Ø§Ù„Ù†Ù‚Ù„",
                "Ù„Ù‚Ø§Ø¡ Ù…Ø¹ Ù…Ø³Ø§Ø¹Ø¯ ÙŠØªØ­Ø¯Ø« Ø§Ù„Ø¥Ø³Ø¨Ø§Ù†ÙŠØ© ÙÙŠ ÙŠÙˆÙ… Ø§Ù„ÙˆØµÙˆÙ„ Ù„Ù„ØªÙˆØ¬ÙŠÙ‡ Ø§Ù„Ø³ÙŠØ§Ø­ÙŠ",
                "ØªØ°Ø§ÙƒØ± Ø§Ù„Ø¹Ø¨Ù‘Ø§Ø±Ø©: Ø¨ÙŠØ±Ø§ÙŠÙˆØ³ â€“ Ù…ÙŠÙƒÙˆÙ†ÙˆØ³ (Ø¹Ø¨Ù‘Ø§Ø±Ø© Ø¹Ø§Ø¯ÙŠØ© Ø¨Ù…Ù‚Ø§Ø¹Ø¯ Ù…Ø±Ù‚Ù‘Ù…Ø©)ØŒ ÙˆÙ…ÙŠÙƒÙˆÙ†ÙˆØ³ â€“ Ø³Ø§Ù†ØªÙˆØ±ÙŠÙ†ÙŠ // Ø³Ø§Ù†ØªÙˆØ±ÙŠÙ†ÙŠ â€“ Ù‡ÙŠØ±Ø§ÙƒÙ„ÙŠÙˆÙ† (Ø¹Ø¨Ù‘Ø§Ø±Ø© Ø³Ø±ÙŠØ¹Ø© â€“ Ø§Ù„Ø¯Ø±Ø¬Ø© Ø§Ù„Ø§Ù‚ØªØµØ§Ø¯ÙŠØ©)",
                "ØªØ°Ø§ÙƒØ± Ø¯Ø®ÙˆÙ„ Ø§Ù„Ù…ØªØ§Ø­Ù ÙˆØ§Ù„Ù…ÙˆØ§Ù‚Ø¹ Ø§Ù„Ø£Ø«Ø±ÙŠØ©",
                "Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø±Ø³ÙˆÙ… ÙˆØ®Ø¯Ù…Ø§ØªÙ†Ø§ (Ø¨Ø§Ø³ØªØ«Ù†Ø§Ø¡ Ø¶Ø±ÙŠØ¨Ø© Ø§Ù„Ø¥Ù‚Ø§Ù…Ø©)"
        ],
        "en": [
                "Two nights accommodation in Athens, two in Mykonos, two in Santorini and two in Crete with breakfast",
                "Half-day shared city tour of Athens with a professional Spanish-speaking guide",
                "All transfers",
                "Meet with a Spanish-speaking assistant on arrival day for travel orientation",
                "Ferry tickets: Piraeus â€“ Mykonos (regular ferry, numbered seats), Mykonos â€“ Santorini // Santorini â€“ Heraklion (high-speed ferry, economy class)",
                "Entrance tickets to museums and archaeological sites",
                "All taxes and our services (except city tax)"
        ],
        "es": [
                "Dos noches de alojamiento en Atenas, dos en Mykonos, dos en Santorini y dos en Creta con desayuno",
                "Visita de la ciudad de Atenas regular de medio dÃ­a con guÃ­a profesional de habla hispana",
                "Todos los traslados",
                "Encuentro con asistente de habla hispana al dÃ­a de llegada por una orientaciÃ³n del viaje",
                "Billetes de ferry Pireo â€“ Mykonos con ferry regular (asientos numerados) y Mykonos â€“ Santorini // Santorini â€“ Heraklion con ferry rÃ¡pido â€“ clase econÃ³mica",
                "Las entradas a los museos y sitios arqueolÃ³gicos",
                "Todas las tasas y nuestros servicios (excepto el impuesto de estancia)"
        ],
        "it": [
                "Due notti di alloggio ad Atene, due a Mykonos, due a Santorini e due a Creta con colazione",
                "Visita guidata di mezza giornata di Atene in pullman con guida professionale di lingua spagnola",
                "Tutti i trasferimenti",
                "Incontro con un assistente di lingua spagnola il giorno dell'arrivo per un orientamento sul viaggio",
                "Biglietti di traghetto: Pireo â€“ Mykonos con traghetto regolare (posti numerati) e Mykonos â€“ Santorini // Santorini â€“ Heraklion con traghetto veloce â€“ classe economica",
                "I biglietti d'ingresso ai musei e siti archeologici",
                "Tutte le tasse e i nostri servizi (esclusa la tassa di soggiorno)"
        ],
        "pt": [
                "Duas noites de hospedagem em Atenas, duas em Mykonos, duas em Santorini e duas em Creta com cafÃ© da manhÃ£",
                "Visita de meio dia regular pela cidade de Atenas com guia profissional de lÃ­ngua espanhola",
                "Todos os transfers",
                "Encontro com assistente de lÃ­ngua espanhola no dia da chegada para orientaÃ§Ã£o da viagem",
                "Bilhetes de ferry: Pireu â€“ Mykonos em ferry regular (assentos numerados) e Mykonos â€“ Santorini // Santorini â€“ HerÃ¡clion em ferry rÃ¡pido â€“ classe econÃ´mica",
                "As entradas para museus e sÃ­tios arqueolÃ³gicos",
                "Todas as taxas e nossos serviÃ§os (exceto o imposto de estadia)"
        ]
},
      excludedServicesJsonb: {
        "ar": [
                "Ø§Ù„ÙˆØ¬Ø¨Ø§Øª ØºÙŠØ± Ø§Ù„Ù…Ø°ÙƒÙˆØ±Ø©",
                "Ø§Ù„Ù…Ø´Ø±ÙˆØ¨Ø§Øª Ø£Ø«Ù†Ø§Ø¡ Ø§Ù„ÙˆØ¬Ø¨Ø§Øª Ø§Ù„Ù…Ø´Ù…ÙˆÙ„Ø©",
                "Ø§Ù„Ù…ØµØ±ÙˆÙØ§Øª Ø§Ù„Ø´Ø®ØµÙŠØ©",
                "Ø§Ù„Ø¥ÙƒØ±Ø§Ù…ÙŠØ§Øª",
                "Ø®Ø¯Ù…Ø© Ø­Ù…Ù„ Ø§Ù„Ø£Ù…ØªØ¹Ø© ÙÙŠ Ø§Ù„ÙÙ†Ø§Ø¯Ù‚",
                "Ø£ÙŠ Ø´ÙŠØ¡ Ø¢Ø®Ø± ØºÙŠØ± Ù…Ø°ÙƒÙˆØ± ØµØ±Ø§Ø­Ø© ÙÙŠ Ø§Ù„ØªØ¶Ù…ÙŠÙ†Ø§Øª"
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
                "Cualquier otra cosa no mencionada especÃ­ficamente en las inclusiones"
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
                "As refeiÃ§Ãµes nÃ£o mencionadas",
                "As bebidas durante as refeiÃ§Ãµes incluÃ­das",
                "Gastos pessoais",
                "Gorjetas",
                "Carregadores de bagagem nos hotÃ©is",
                "Qualquer outra coisa nÃ£o mencionada especificamente nas inclusÃµes"
        ]
},
      itineraries: [
        {
                "dayLabel": "Day 1",
                "titleJsonb": {
                        "ar": "Ø§Ù„ÙˆØµÙˆÙ„ / Ø£Ø«ÙŠÙ†Ø§",
                        "en": "Arrival / Athens",
                        "es": "Llegada / Atenas",
                        "it": "Arrivo / Atene",
                        "pt": "Chegada / Atenas"
                },
                "descriptionJsonb": {
                        "ar": "Ø§Ù„ÙˆØµÙˆÙ„ Ø¥Ù„Ù‰ Ø§Ù„Ù…Ø·Ø§Ø± ÙˆØ§Ù„Ø§Ù„ØªÙ‚Ø§Ø¡ Ø¨Ù…Ø³Ø¤ÙˆÙ„ Ø§Ù„Ø§Ø³ØªÙ‚Ø¨Ø§Ù„ Ù…Ù† Ø§Ù„ÙˆÙƒØ§Ù„Ø©. Ø§Ù„Ù†Ù‚Ù„ Ø¥Ù„Ù‰ Ø§Ù„ÙÙ†Ø¯Ù‚. Ø¨Ø§Ù‚ÙŠ Ø§Ù„ÙŠÙˆÙ… Ø­Ø±. Ø§Ù„Ø¥Ù‚Ø§Ù…Ø©.",
                        "en": "Arrival at the airport and meet with the agency assistance. Transfer to the hotel. Rest of the day free. Accommodation.",
                        "es": "Llegada al aeropuerto y encuentro con la asistencia de la agencia. Traslado al hotel. Resto del dÃ­a libre. Alojamiento.",
                        "it": "Arrivo in aeroporto e incontro con l'assistenza dell'agenzia. Trasferimento in hotel. Resto della giornata libero. Sistemazione.",
                        "pt": "Chegada ao aeroporto e encontro com a assistÃªncia da agÃªncia. Transfer para o hotel. Resto do dia livre. Hospedagem."
                },
                "mealsJsonb": {
                        "ar": "ØºÙŠØ± Ù…Ø´Ù…ÙˆÙ„",
                        "en": "Not included",
                        "es": "Sin comidas",
                        "it": "Non incluso",
                        "pt": "NÃ£o incluÃ­do"
                },
                "sortOrder": 0
        },
        {
                "dayLabel": "Day 2",
                "titleJsonb": {
                        "ar": "Ø¬ÙˆÙ„Ø© ÙÙŠ Ø§Ù„Ù…Ø¯ÙŠÙ†Ø© / Ø£Ø«ÙŠÙ†Ø§",
                        "en": "City Tour / Athens",
                        "es": "Visita de la ciudad / Atenas",
                        "it": "Visita della cittÃ  / Atene",
                        "pt": "Visita da cidade / Atenas"
                },
                "descriptionJsonb": {
                        "ar": "Ø¥ÙØ·Ø§Ø± ÙˆØ§Ù†Ø·Ù„Ø§Ù‚ Ø¨Ø§Ù„Ø­Ø§ÙÙ„Ø© Ù„Ø²ÙŠØ§Ø±Ø© Ø£Ø´Ù‡Ø± Ù…Ø¹Ø§Ù„Ù… Ø£Ø«ÙŠÙ†Ø§. Ø®Ù„Ø§Ù„ Ø§Ù„Ø¬ÙˆÙ„Ø© Ù†Ù…Ø± Ø¨Ø§Ù„Ø¨Ø±Ù„Ù…Ø§Ù† Ù…Ø¹ Ù†ØµØ¨ Ø§Ù„Ø¬Ù†Ø¯ÙŠ Ø§Ù„Ù…Ø¬Ù‡ÙˆÙ„ØŒ Ø³Ø§Ø­Ø© Ø³ÙŠÙ†ØªØ§ØºÙ…Ø§ØŒ Ø§Ù„Ø«Ù„Ø§Ø«ÙŠØ© Ø§Ù„ÙƒÙ„Ø§Ø³ÙŠÙƒÙŠØ© Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø©ØŒ Ø³Ø§Ø­Ø© Ø£ÙˆÙ…ÙˆÙ†ÙŠØ§ØŒ Ù…Ø¨Ù†Ù‰ Ø§Ù„Ø¨Ø±Ù„Ù…Ø§Ù† Ø§Ù„Ø°ÙŠ ÙŠØ¹ÙˆØ¯ Ù„Ù„Ù‚Ø±Ù† 19ØŒ Ø§Ù„ÙƒØ§ØªØ¯Ø±Ø§Ø¦ÙŠØ© Ø§Ù„ÙƒØ§Ø«ÙˆÙ„ÙŠÙƒÙŠØ©ØŒ Ù…Ø¹Ø¨Ø¯ Ø²ÙŠÙˆØ³ Ø§Ù„Ø±ÙˆÙ…Ø§Ù†ÙŠØŒ Ù‚ÙˆØ³ Ù‡Ø§Ø¯Ø±ÙŠØ§Ù† ÙˆÙ†ØªÙˆÙ‚Ù Ù„Ø§Ù„ØªÙ‚Ø§Ø· Ø§Ù„ØµÙˆØ± ÙÙŠ Ø§Ù„Ù…Ù„Ø¹Ø¨ Ø§Ù„Ø£ÙˆÙ„Ù…Ø¨ÙŠ Ø§Ù„Ø´Ù‡ÙŠØ± Ø­ÙŠØ« Ø£Ù‚ÙŠÙ…Øª Ø£ÙˆÙ„ Ø¯ÙˆØ±Ø© Ø£Ù„Ø¹Ø§Ø¨ Ø£ÙˆÙ„Ù…Ø¨ÙŠØ© Ø­Ø¯ÙŠØ«Ø© ÙÙŠ Ø¹Ø§Ù… 1896. Ø²ÙŠØ§Ø±Ø© Ø§Ù„Ø£ÙƒØ±ÙˆØ¨ÙˆÙ„ÙŠØ³ Ù…Ø¹ Ø§Ù„Ø¨Ø±ÙˆØ¨ÙŠÙ„ÙŠØ§ØŒ Ù…Ø¹Ø¨Ø¯ Ø£Ø«ÙŠÙ†Ø§ Ù†Ø§ÙŠÙƒÙŠØŒ Ø§Ù„Ø¨Ø§Ø±Ø«ÙŠÙ†ÙˆÙ† ÙˆØ§Ù„Ø¥Ø±Ø®Ø«ÙŠÙˆÙ†. ÙˆÙ‚Øª Ø­Ø± Ù„Ø§Ø³ØªÙƒØ´Ø§Ù Ø§Ù„Ø¨Ù„Ø¯Ø© Ø§Ù„Ù‚Ø¯ÙŠÙ…Ø© ÙÙŠ Ø¨Ù„Ø§ÙƒØ§. Ø§Ù„Ø¥Ù‚Ø§Ù…Ø©.",
                        "en": "Breakfast and departure by coach to tour the most famous monuments of Athens. During the tour we pass by the Parliament with the monument of the Unknown Soldier, Syntagma Square, the neoclassical Trilogy, Omonia Square, the 19th-century Parliament building, the Catholic Cathedral, the Roman Temple of Zeus, Hadrian's Arch and stop for photos at the famous Olympic Stadium where the first modern Olympic Games were held in 1896. Visit of the Acropolis with the Propylaea, the Temple of Athena Nike, the Parthenon and the Erechtheion. Free time to explore the old quarter of Plaka. Accommodation.",
                        "es": "Desayuno y salida en autocar para recorrer los monumentos mÃ¡s famosos de Atenas. Durante el recorrido pasamos por el Parlamento con el monumento del Soldado Desconocido, la plaza Sintagma, la TrilogÃ­a neoclÃ¡sica, la plaza Omonia, el Parlamento del siglo 19, la catedral CatÃ³lica, el templo romano de Zeus, el Arco de Adriano y paramos para sacar fotos al famoso estadio OlÃ­mpico donde se celebraron los primeros Juegos OlÃ­mpicos modernos en 1896. Visita de la AcrÃ³polis con los Propileos, el templo de Atenea Nike, el PartenÃ³n y el ErecteÃ³n. Tiempo libre para explorar el casco antiguo de Plaka. Alojamiento.",
                        "it": "Colazione e partenza in pullman per visitare i monumenti piÃ¹ famosi di Atene. Durante il percorso passiamo dal Parlamento con il monumento del Milite Ignoto, piazza Syntagma, la Trilogia neoclassica, piazza Omonia, il Palazzo del Parlamento del XIX secolo, la cattedrale Cattolica, il tempio romano di Zeus, l'Arco di Adriano e ci fermiamo per foto al famoso stadio Olimpico dove si sono svolti i primi Giochi Olimpici moderni nel 1896. Visita dell'Acropoli con i Propilei, il tempio di Atena Nike, il Partenone e l'Eretteo. Tempo libero per esplorare il centro storico di Plaka. Sistemazione.",
                        "pt": "CafÃ© da manhÃ£ e saÃ­da de autocarro para percorrer os monumentos mais famosos de Atenas. Durante o percurso passamos pelo Parlamento com o monumento do Soldado Desconhecido, a praÃ§a Syntagma, a Trilogia neoclÃ¡ssica, a praÃ§a Omonia, o Parlamento do sÃ©culo XIX, a catedral CatÃ³lica, o templo romano de Zeus, o Arco de Adriano e paramos para fotos no famoso estÃ¡dio OlÃ­mpico onde se realizaram os primeiros Jogos OlÃ­mpicos modernos em 1896. Visita da AcrÃ³pole com os Propileus, o templo de Atena NikÃ©, o Partenon e o Erecteion. Tempo livre para explorar o centro histÃ³rico de Plaka. Hospedagem."
                },
                "mealsJsonb": {
                        "ar": "Ø¥ÙØ·Ø§Ø±",
                        "en": "Breakfast",
                        "es": "Desayuno",
                        "it": "Colazione",
                        "pt": "CafÃ© da manhÃ£"
                },
                "sortOrder": 1
        },
        {
                "dayLabel": "Day 3",
                "titleJsonb": {
                        "ar": "Ø¨ÙŠØ±Ø§ÙŠÙˆØ³ â€“ Ù…ÙŠÙƒÙˆÙ†ÙˆØ³ / Ù…ÙŠÙƒÙˆÙ†ÙˆØ³",
                        "en": "Piraeus â€“ Mykonos / Mykonos",
                        "es": "Pireo â€“ Mykonos / Mykonos",
                        "it": "Il Pireo â€“ Mykonos / Mykonos",
                        "pt": "Pireu â€“ Mykonos / Mykonos"
                },
                "descriptionJsonb": {
                        "ar": "Ø¥ÙØ·Ø§Ø± ÙˆÙ†Ù‚Ù„ Ø¥Ù„Ù‰ Ù…ÙŠÙ†Ø§Ø¡ Ø¨ÙŠØ±Ø§ÙŠÙˆØ³ Ù„Ù„ØµØ¹ÙˆØ¯ Ø¹Ù„Ù‰ Ù…ØªÙ† Ø§Ù„Ø¹Ø¨Ø§Ø±Ø© Ø§Ù„Ù…ØªØ¬Ù‡Ø© Ø¥Ù„Ù‰ Ù…ÙŠÙƒÙˆÙ†ÙˆØ³. Ø¹Ù†Ø¯ Ø§Ù„ÙˆØµÙˆÙ„ Ø¥Ù„Ù‰ Ø§Ù„Ø¬Ø²ÙŠØ±Ø©ØŒ Ø§Ù„Ù†Ù‚Ù„ Ø¥Ù„Ù‰ Ø§Ù„ÙÙ†Ø¯Ù‚ ÙˆØ¨Ø§Ù‚ÙŠ Ø§Ù„ÙŠÙˆÙ… Ø­Ø±. Ø§Ù„Ø¥Ù‚Ø§Ù…Ø©.",
                        "en": "Breakfast and transfer to the port of Piraeus to board the ferry bound for Mykonos. Upon arrival on the island, transfer to the hotel and rest of the day free. Accommodation.",
                        "es": "Desayuno y traslado al puerto del Pireo para embarcar en el ferry con destino a Mykonos. A su llegada a la isla, traslado al hotel y resto del dÃ­a libre. Alojamiento.",
                        "it": "Colazione e trasferimento al porto del Pireo per imbarcarsi sul traghetto diretto a Mykonos. All'arrivo sull'isola, trasferimento in hotel e resto della giornata libero. Sistemazione.",
                        "pt": "CafÃ© da manhÃ£ e transfer para o porto do Pireu para embarcar no ferry com destino a Mykonos. Ã€ sua chegada Ã  ilha, transfer para o hotel e resto do dia livre. Hospedagem."
                },
                "mealsJsonb": {
                        "ar": "Ø¥ÙØ·Ø§Ø±",
                        "en": "Breakfast",
                        "es": "Desayuno",
                        "it": "Colazione",
                        "pt": "CafÃ© da manhÃ£"
                },
                "sortOrder": 2
        },
        {
                "dayLabel": "Day 4",
                "titleJsonb": {
                        "ar": "ÙŠÙˆÙ… Ø­Ø± / Ù…ÙŠÙƒÙˆÙ†ÙˆØ³",
                        "en": "Free Day / Mykonos",
                        "es": "DÃ­a libre / Mykonos",
                        "it": "Giorno libero / Mykonos",
                        "pt": "Dia livre / Mykonos"
                },
                "descriptionJsonb": {
                        "ar": "ÙŠÙˆÙ… Ø­Ø± ÙÙŠ Ø¬Ø²ÙŠØ±Ø© Ù…ÙŠÙƒÙˆÙ†ÙˆØ³ Ø§Ù„Ø´Ù‡ÙŠØ±Ø©ØŒ Ù†Ù‚Ø·Ø© Ø§Ù„Ø§Ù„ØªÙ‚Ø§Ø¡ Ø§Ù„Ø¯ÙˆÙ„ÙŠØ© Ù„Ù…Ø­Ø¨ÙŠ \"Ø§Ù„Ø¬ÙŠØª Ø³ÙŠØª\". Ø§Ø³ØªÙ…ØªØ¹ Ø¨Ø§Ù„Ø´ÙˆØ§Ø·Ø¦ Ø§Ù„Ø±Ø§Ø¦Ø¹Ø© ÙˆØ§Ù„Ù…ØªØ§Ø¬Ø± Ø§Ù„Ù…Ø¨Ù‡Ø±Ø© ÙˆØ§Ù„Ø­ÙŠØ§Ø© Ø§Ù„Ù„ÙŠÙ„ÙŠØ© Ø§Ù„ØªÙŠ Ù„Ø§ ØªØ¶Ø§Ù‡Ù‰. Ø¥ÙØ·Ø§Ø± ÙˆØ¥Ù‚Ø§Ù…Ø© ÙÙŠ Ø§Ù„ÙÙ†Ø¯Ù‚.",
                        "en": "Free day on the famous island of Mykonos, the international meeting point of the \"jet set\". Enjoy the wonderful beaches, dazzling shops and incomparable nightlife. Breakfast and accommodation at the hotel.",
                        "es": "DÃ­a libre en la famosa isla de Mykonos, el punto internacional del encuentro del \"jet set\". Disfrute las playas maravillosas, tiendas deslumbrantes y la incomparable vida nocturna. Desayuno y alojamiento en el hotel.",
                        "it": "Giorno libero nella famosa isola di Mykonos, il punto d'incontro internazionale del \"jet set\". Godetevi le splendide spiagge, i negozi scintillanti e l'incomparabile vita notturna. Colazione e sistemazione in hotel.",
                        "pt": "Dia livre na famosa ilha de Mykonos, o ponto de encontro internacional do \"jet set\". Desfrute das maravilhosas praias, lojas deslumbrantes e a incomparÃ¡vel vida noturna. CafÃ© da manhÃ£ e hospedagem no hotel."
                },
                "mealsJsonb": {
                        "ar": "Ø¥ÙØ·Ø§Ø±",
                        "en": "Breakfast",
                        "es": "Desayuno",
                        "it": "Colazione",
                        "pt": "CafÃ© da manhÃ£"
                },
                "sortOrder": 3
        },
        {
                "dayLabel": "Day 5",
                "titleJsonb": {
                        "ar": "Ù…ÙŠÙƒÙˆÙ†ÙˆØ³ â€“ Ø³Ø§Ù†ØªÙˆØ±ÙŠÙ†ÙŠ / Ø³Ø§Ù†ØªÙˆØ±ÙŠÙ†ÙŠ",
                        "en": "Mykonos â€“ Santorini / Santorini",
                        "es": "Mykonos â€“ Santorini / Santorini",
                        "it": "Mykonos â€“ Santorini / Santorini",
                        "pt": "Mykonos â€“ Santorini / Santorini"
                },
                "descriptionJsonb": {
                        "ar": "Ø¥ÙØ·Ø§Ø± ÙˆØµØ¨Ø§Ø­ Ø­Ø± Ø­ØªÙ‰ Ù…ÙˆØ¹Ø¯ Ø§Ù„Ù†Ù‚Ù„ Ø¥Ù„Ù‰ Ù…ÙŠÙ†Ø§Ø¡ Ù…ÙŠÙƒÙˆÙ†ÙˆØ³ Ù„Ù„ØµØ¹ÙˆØ¯ Ø¹Ù„Ù‰ Ù…ØªÙ† Ø§Ù„Ø¹Ø¨Ø§Ø±Ø© Ø§Ù„Ù…ØªØ¬Ù‡Ø© Ø¥Ù„Ù‰ Ø³Ø§Ù†ØªÙˆØ±ÙŠÙ†ÙŠ. Ø¹Ù†Ø¯ Ø§Ù„ÙˆØµÙˆÙ„ Ø¥Ù„Ù‰ Ø§Ù„Ø¬Ø²ÙŠØ±Ø©ØŒ Ø§Ù„Ù†Ù‚Ù„ Ø¥Ù„Ù‰ Ø§Ù„ÙÙ†Ø¯Ù‚ ÙˆØ¨Ø§Ù‚ÙŠ Ø§Ù„ÙŠÙˆÙ… Ø­Ø±. Ø§Ù„Ø¥Ù‚Ø§Ù…Ø©.",
                        "en": "Breakfast and free morning until the transfer time to the port of Mykonos to board the ferry bound for Santorini. Upon arrival on the island, transfer to the hotel and rest of the day free. Accommodation.",
                        "es": "Desayuno y maÃ±ana libre hasta la hora de traslado al puerto de Mykonos para embarcar en el ferry con destino a Santorini. A su llegada a la isla, traslado al hotel y resto del dÃ­a libre. Alojamiento.",
                        "it": "Colazione e mattinata libera fino all'orario del trasferimento al porto di Mykonos per imbarcarsi sul traghetto diretto a Santorini. All'arrivo sull'isola, trasferimento in hotel e resto della giornata libero. Sistemazione.",
                        "pt": "CafÃ© da manhÃ£ e manhÃ£ livre atÃ© a hora do transfer para o porto de Mykonos para embarcar no ferry com destino a Santorini. Ã€ sua chegada Ã  ilha, transfer para o hotel e resto do dia livre. Hospedagem."
                },
                "mealsJsonb": {
                        "ar": "Ø¥ÙØ·Ø§Ø±",
                        "en": "Breakfast",
                        "es": "Desayuno",
                        "it": "Colazione",
                        "pt": "CafÃ© da manhÃ£"
                },
                "sortOrder": 4
        },
        {
                "dayLabel": "Day 6",
                "titleJsonb": {
                        "ar": "ÙŠÙˆÙ… Ø­Ø± / Ø³Ø§Ù†ØªÙˆØ±ÙŠÙ†ÙŠ",
                        "en": "Free Day / Santorini",
                        "es": "DÃ­a libre / Santorini",
                        "it": "Giorno libero / Santorini",
                        "pt": "Dia livre / Santorini"
                },
                "descriptionJsonb": {
                        "ar": "ÙŠÙˆÙ… Ø­Ø± Ù„Ø§Ø³ØªÙƒØ´Ø§Ù Ø¬Ø²ÙŠØ±Ø© Ø³Ø§Ù†ØªÙˆØ±ÙŠÙ†ÙŠ Ø§Ù„Ø³Ø§Ø­Ø±Ø©. Ø§ÙƒØªØ´Ù ÙÙŠØ±Ø§ ÙˆØ£ÙˆÙŠØ§ Ù…Ø¹ Ø§Ù„Ø¥Ø·Ù„Ø§Ù„Ø§Øª Ø§Ù„Ø®Ù„Ø§Ø¨Ø© Ø¹Ù„Ù‰ Ø§Ù„Ø¨Ø±ÙƒØ§Ù†ØŒ ÙˆØ§Ø³ØªÙ…ØªØ¹ Ø¨ÙˆØ§Ø­Ø¯Ø© Ù…Ù† Ø£ÙØ¶Ù„ ØºØ±ÙˆØ¨ Ø§Ù„Ø´Ù…Ø³ ÙÙŠ Ø¨Ø­Ø± Ø¥ÙŠØ¬Ø©. Ø§Ø³ØªÙƒØ´Ù Ø§Ù„Ø´ÙˆØ§Ø·Ø¦ Ø§Ù„ÙØ±ÙŠØ¯Ø© Ø°Ø§Øª Ø§Ù„Ø±Ù…Ø§Ù„ Ø§Ù„Ø³ÙˆØ¯Ø§Ø¡ Ø£Ùˆ Ù‚Ù… Ø¨Ø¬ÙˆÙ„Ø© Ø¨Ø­Ø±ÙŠØ© Ø¥Ù„Ù‰ Ø¬Ø²Ø± Ø§Ù„ÙƒØ§Ù„Ø¯ÙŠØ±Ø§.",
                        "en": "Free day to explore the magical island of Santorini. Discover Fira & Oia with the stunning views of the volcano, and enjoy one of the best sunsets in the Aegean Sea. Explore the unique black sand beaches or take a boat tour to the caldera islands.",
                        "es": "DÃ­a libre para explorar la isla mÃ¡gica de Santorini. Descubra Fira & Oia con las impresionantes vistas al volcÃ¡n, y disfrute de uno de los mejores atardeceres en el mar Egeo. Explora las playas Ãºnicas de arena negra o tomar un tour en barco a las islas de la caldera.",
                        "it": "Giorno libero per esplorare la magica isola di Santorini. Scoprite Fira e Oia con le spettacolari viste sul vulcano e godetevi uno dei migliori tramonti del Mar Egeo. Esplorate le uniche spiagge di sabbia nera o fate un giro in barca alle isole della caldera.",
                        "pt": "Dia livre para explorar a mÃ¡gica ilha de Santorini. Descubra Fira & Oia com as impressionantes vistas para o vulcÃ£o, e desfrute de um dos melhores pores do sol no Mar Egeu. Explore as praias Ãºnicas de areia preta ou faÃ§a um passeio de barco para as ilhas da caldeira."
                },
                "mealsJsonb": {
                        "ar": "Ø¥ÙØ·Ø§Ø±",
                        "en": "Breakfast",
                        "es": "Desayuno",
                        "it": "Colazione",
                        "pt": "CafÃ© da manhÃ£"
                },
                "sortOrder": 5
        },
        {
                "dayLabel": "Day 7",
                "titleJsonb": {
                        "ar": "Ø³Ø§Ù†ØªÙˆØ±ÙŠÙ†ÙŠ â€“ Ù‡ÙŠØ±Ø§ÙƒÙ„ÙŠÙˆÙ† / ÙƒØ±ÙŠØª",
                        "en": "Santorini â€“ Heraklion / Crete",
                        "es": "Santorini â€“ Heraklion / Creta",
                        "it": "Santorini â€“ Heraklion / Creta",
                        "pt": "Santorini â€“ HerÃ¡clion / Creta"
                },
                "descriptionJsonb": {
                        "ar": "Ø¥ÙØ·Ø§Ø± ÙˆÙ†Ù‚Ù„ Ø¥Ù„Ù‰ Ù…ÙŠÙ†Ø§Ø¡ Ø³Ø§Ù†ØªÙˆØ±ÙŠÙ†ÙŠ Ù„Ù„ØµØ¹ÙˆØ¯ Ø¹Ù„Ù‰ Ù…ØªÙ† Ø§Ù„Ø¹Ø¨Ø§Ø±Ø© Ø§Ù„Ø³Ø±ÙŠØ¹Ø© Ø§Ù„Ù…ØªØ¬Ù‡Ø© Ø¥Ù„Ù‰ Ù‡ÙŠØ±Ø§ÙƒÙ„ÙŠÙˆÙ†. Ø¹Ù†Ø¯ Ø§Ù„ÙˆØµÙˆÙ„ Ø¥Ù„Ù‰ Ø§Ù„Ø¬Ø²ÙŠØ±Ø©ØŒ Ø§Ù„Ù†Ù‚Ù„ Ø¥Ù„Ù‰ Ø§Ù„ÙÙ†Ø¯Ù‚ ÙˆØ¨Ø§Ù‚ÙŠ Ø§Ù„ÙŠÙˆÙ… Ø­Ø±. Ø§Ù„Ø¥Ù‚Ø§Ù…Ø©.",
                        "en": "Breakfast and transfer to the port of Santorini to board the high-speed ferry bound for Heraklion. Upon arrival on the island, transfer to the hotel and rest of the day free. Accommodation.",
                        "es": "Desayuno y traslado al puerto de Santorini para embarcar en el ferry rÃ¡pido con destino a Heraklion. A su llegada a la isla, traslado al hotel y resto del dÃ­a libre. Alojamiento.",
                        "it": "Colazione e trasferimento al porto di Santorini per imbarcarsi sul traghetto veloce diretto a Heraklion. All'arrivo sull'isola, trasferimento in hotel e resto della giornata libero. Sistemazione.",
                        "pt": "CafÃ© da manhÃ£ e transfer para o porto de Santorini para embarcar no ferry rÃ¡pido com destino a HerÃ¡clion. Ã€ sua chegada Ã  ilha, transfer para o hotel e resto do dia livre. Hospedagem."
                },
                "mealsJsonb": {
                        "ar": "Ø¥ÙØ·Ø§Ø±",
                        "en": "Breakfast",
                        "es": "Desayuno",
                        "it": "Colazione",
                        "pt": "CafÃ© da manhÃ£"
                },
                "sortOrder": 6
        },
        {
                "dayLabel": "Day 8",
                "titleJsonb": {
                        "ar": "ÙŠÙˆÙ… Ø­Ø± / ÙƒØ±ÙŠØª",
                        "en": "Free Day / Crete",
                        "es": "DÃ­a libre / Creta",
                        "it": "Giorno libero / Creta",
                        "pt": "Dia livre / Creta"
                },
                "descriptionJsonb": {
                        "ar": "ÙŠÙˆÙ… Ø­Ø± Ù„Ø§Ø³ØªÙƒØ´Ø§Ù Ø£ÙƒØ¨Ø± Ø§Ù„Ø¬Ø²Ø± Ø§Ù„ÙŠÙˆÙ†Ø§Ù†ÙŠØ©. ØªØ£ÙƒØ¯ Ù…Ù† ØªØ°ÙˆÙ‚ Ø§Ù„Ø·Ø¹Ø§Ù… Ø§Ù„ÙƒØ±ÙŠØªÙŠ Ø§Ù„ÙØ±ÙŠØ¯ØŒ ÙˆØ§Ø³ØªÙƒØ´Ø§Ù Ø§Ù„Ø­Ø¶Ø§Ø±Ø© Ø§Ù„Ù…ÙŠÙ†ÙˆÙŠØ© ÙÙŠ ÙƒÙ†ÙˆØ³ÙˆØ³ØŒ ÙˆØ§ÙƒØªØ´Ø§Ù Ø´ÙˆØ§Ø·Ø¦ Ø¥Ù„ÙˆÙ†Ø¯Ø§ Ø§Ù„Ø¬Ù…ÙŠÙ„Ø©ØŒ ÙˆØ§Ù„Ø§Ø³ØªÙ…ØªØ§Ø¹ Ø¨Ø±Ø­Ù„Ø© Ø¨Ø­Ø±ÙŠØ© Ø¥Ù„Ù‰ Ø¬Ø²ÙŠØ±Ø© Ø³Ø¨ÙŠÙ†Ø§Ù„ÙˆÙ†ØºØ§ Ø§Ù„ØªØ§Ø±ÙŠØ®ÙŠØ©.",
                        "en": "Free day to explore the largest of the Greek islands. Be sure to try the unique Cretan food, explore the Minoan civilization at Knossos, discover the beautiful beaches of Elounda, and enjoy a boat trip to the historic Spinalonga.",
                        "es": "DÃ­a libre para explorar el mÃ¡s grande de las islas griegas. AsegÃºrese de probar la comida cretense Ãºnica, explorar la civilizaciÃ³n minoica en Knossos, descubrir las hermosas playas de Elunda, y disfrutar de un paseo en barco a la histÃ³rica Spinalonga.",
                        "it": "Giorno libero per esplorare la piÃ¹ grande delle isole greche. Assicuratevi di assaggiare l'unico cibo cretese, esplorare la civiltÃ  minoica a Cnosso, scoprire le bellissime spiagge di Elounda e godervi un giro in barca alla storica Spinalonga.",
                        "pt": "Dia livre para explorar a maior das ilhas gregas. Certifique-se de provar a comida cretense Ãºnica, explorar a civilizaÃ§Ã£o minoica em Cnossos, descobrir as belas praias de Elounda e desfrutar de um passeio de barco para a histÃ³rica Spinalonga."
                },
                "mealsJsonb": {
                        "ar": "Ø¥ÙØ·Ø§Ø±",
                        "en": "Breakfast",
                        "es": "Desayuno",
                        "it": "Colazione",
                        "pt": "CafÃ© da manhÃ£"
                },
                "sortOrder": 7
        },
        {
                "dayLabel": "Day 9",
                "titleJsonb": {
                        "ar": "Ø§Ù„Ù…ØºØ§Ø¯Ø±Ø©",
                        "en": "Departure",
                        "es": "Salida",
                        "it": "Partenza",
                        "pt": "Partida"
                },
                "descriptionJsonb": {
                        "ar": "Ø¥ÙØ·Ø§Ø± ÙˆØµØ¨Ø§Ø­ Ø­Ø± Ø­ØªÙ‰ Ù…ÙˆØ¹Ø¯ Ø§Ù„Ù†Ù‚Ù„ Ø¥Ù„Ù‰ Ø§Ù„Ù…Ø·Ø§Ø± Ù„Ø±Ø­Ù„Ø© Ø¯Ø§Ø®Ù„ÙŠØ© Ù‚ØµÙŠØ±Ø©ØŒ Ù…Ø±ØªØ¨Ø·Ø© Ø¨Ø±Ø­Ù„Ø© Ø¹ÙˆØ¯ØªÙƒ Ø§Ù„Ø¯ÙˆÙ„ÙŠØ©.",
                        "en": "Breakfast and free morning until the transfer time to the airport for a short domestic flight, connecting with your international return flight.",
                        "es": "Desayuno y maÃ±ana libre hasta la hora de traslado al aeropuerto para un vuelo domÃ©stico corto, conectado con su vuelo de regreso internacional.",
                        "it": "Colazione e mattinata libera fino all'orario del trasferimento in aeroporto per un breve volo domestico, in coincidenza con il vostro volo di ritorno internazionale.",
                        "pt": "CafÃ© da manhÃ£ e manhÃ£ livre atÃ© a hora do transfer para o aeroporto para um curto voo domÃ©stico, conectando com seu voo internacional de regresso."
                },
                "mealsJsonb": {
                        "ar": "Ø¥ÙØ·Ø§Ø±",
                        "en": "Breakfast",
                        "es": "Desayuno",
                        "it": "Colazione",
                        "pt": "CafÃ© da manhÃ£"
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
        ar: 'ØªÙˆØ§Ø¨Ù„ Ø§Ù„Ù…ØºØ±Ø¨',
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
        ar: '05 Ø£ÙŠØ§Ù… / 04 Ù„ÙŠØ§Ù„Ù',
        en: '05 Days / 04 Nights',
        es: '05 DÃ­as / 04 Noches',
        it: '05 Giorni / 04 Notti',
        pt: '05 Dias / 04 Noites',
      },
      minPaxJsonb: {
        ar: 'ÙØ±Ø¯Ø§Ù†',
        en: '2 Pax',
        es: '2 Pax',
        it: '2 Pax',
        pt: '2 Pax',
      },
      highlightsJsonb: {
        ar: [
          'Ø²ÙŠØ§Ø±Ø© Ù…Ø¯ÙŠÙ†Ø© Ù…ÙƒÙ†Ø§Ø³ Ø§Ù„Ø¥Ù…Ø¨Ø±Ø§Ø·ÙˆØ±ÙŠØ©',
          'Ø¬ÙˆÙ„Ø© ÙƒØ§Ù…Ù„Ø© ÙÙŠ ÙØ§Ø³ Ø§Ù„Ø¹Ø§ØµÙ…Ø© Ø§Ù„Ø¯ÙŠÙ†ÙŠØ©',
          'Ø²ÙŠØ§Ø±Ø© Ø§Ù„Ø±Ø¨Ø§Ø· ÙˆØ§Ù„Ø¯Ø§Ø± Ø§Ù„Ø¨ÙŠØ¶Ø§Ø¡ ÙˆÙ…Ø±Ø§ÙƒØ´',
          'Ø³Ø§Ø­Ø© Ø¬Ø§Ù…Ø¹ Ø§Ù„ÙÙ†Ø§Ø¡ ÙˆØ§Ù„Ø£Ø³ÙˆÙ‚ Ø§Ù„ØªÙ‚Ù„ÙŠØ¯ÙŠØ©',
          'Ø¹Ø¨ÙˆØ± Ø§Ù„Ø¨Ø­Ø± Ø§Ù„Ø£Ø¨ÙŠØ¶ Ø§Ù„Ù…ØªÙˆØ³Ø· Ø¨Ø§Ù„Ø¹Ø¨Ø§Ø±Ø©',
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
          'TravesÃ­a del MediterrÃ¡neo en ferry',
        ],
        it: [
          'Visita alla cittÃ  imperiale di Meknes',
          'Tour completo di Fez, capitale religiosa',
          'Visita a Rabat, Casablanca e Marrakech',
          'Piazza Jemaa el Fna e souk tradizionali',
          'Attraversamento del Mediterraneo in traghetto',
        ],
        pt: [
          'Visita Ã  cidade imperial de Meknes',
          'Visita completa a Fez, capital religiosa',
          'Visita a Rabat, Casablanca e Marraquexe',
          'PraÃ§a Jemaa el Fna e souks tradicionais',
          'Travessia do MediterrÃ¢neo de ferry',
        ],
      },
      pricingJsonb: {
        hotels: [
          { ar: 'ÙÙ†Ø¯Ù‚ 4 Ù†Ø¬ÙˆÙ…', en: '4 Star Hotel', es: 'Hotel 4 Estrellas', it: 'Hotel 4 Stelle', pt: 'Hotel 4 Estrelas' },
        ],
        winter: [{ dbl: 899, sgl: 350 }],
        summer: [{ dbl: 799, sgl: 280 }],
        winterDates: '01 Oct â€“ 30 Apr',
        summerDates: '01 May â€“ 30 Sep',
      },
      overviewJsonb: {
        ar: 'Ø±Ø­Ù„Ø© 5 Ø£ÙŠØ§Ù… Ù„Ø§ÙƒØªØ´Ø§Ù ÙƒÙ†ÙˆØ² Ø§Ù„Ù…ØºØ±Ø¨: Ù…Ù† Ø·Ù†Ø¬Ø© Ø¥Ù„Ù‰ Ù…Ø±Ø§ÙƒØ´ Ù…Ø±ÙˆØ±Ø§Ù‹ Ø¨ÙØ§Ø³ ÙˆØ§Ù„Ø±Ø¨Ø§Ø· ÙˆØ§Ù„Ø¯Ø§Ø± Ø§Ù„Ø¨ÙŠØ¶Ø§Ø¡. Ø§Ø³ØªÙ…ØªØ¹ Ø¨Ø§Ù„Ù…Ø¯Ù† Ø§Ù„Ø¥Ù…Ø¨Ø±Ø§Ø·ÙˆØ±ÙŠØ© ÙˆØ§Ù„Ø£Ø³ÙˆØ§Ù‚ Ø§Ù„ØªÙ‚Ù„ÙŠØ¯ÙŠØ© ÙˆØ§Ù„Ù‡Ù†Ø¯Ø³Ø© Ø§Ù„Ù…Ø¹Ù…Ø§Ø±ÙŠØ© Ø§Ù„Ù…ØºØ±Ø¨ÙŠØ© Ø§Ù„Ø£ØµÙŠÙ„Ø©.',
        en: 'A 5-day journey to discover the treasures of Morocco: from Tangier to Marrakech via Fez, Rabat and Casablanca. Enjoy imperial cities, traditional souks and authentic Moroccan architecture.',
        es: 'Un viaje de 5 dÃ­as para descubrir los tesoros de Marruecos: desde TÃ¡nger hasta Marrakech pasando por Fez, Rabat y Casablanca. Disfrute de ciudades imperiales, zocos tradicionales y autÃ©ntica arquitectura marroquÃ­.',
        it: 'Un viaggio di 5 giorni alla scoperta dei tesori del Marocco: da Tangeri a Marrakech passando per Fez, Rabat e Casablanca. Godetevi cittÃ  imperiali, souk tradizionali e autentica architettura marocchina.',
        pt: 'Uma viagem de 5 dias para descobrir os tesouros de Marrocos: de TÃ¢nger a Marraquexe passando por Fez, Rabat e Casablanca. Desfrute de cidades imperiais, souks tradicionais e autÃªntica arquitetura marroquina.',
      },
      includedServicesJsonb: {
        ar: [
          'Ø§Ù„Ù†Ù‚Ù„: ÙƒÙˆØ³ØªØ§ Ø¯ÙŠÙ„ Ø³ÙˆÙ„ / Ø·Ø±ÙŠÙØ© / ÙƒÙˆØ³ØªØ§ Ø¯ÙŠÙ„ Ø³ÙˆÙ„',
          'ØªØ°Ø§ÙƒØ± Ø§Ù„Ø¹Ø¨Ø§Ø±Ø©: Ø·Ø±ÙŠÙØ© / Ø·Ù†Ø¬Ø© / Ø·Ø±ÙŠÙØ©',
          'Ø§Ù„Ù†Ù‚Ù„ Ø¯Ø§Ø®Ù„ Ø§Ù„Ù…ØºØ±Ø¨',
          'Ù…Ø±Ø´Ø¯ Ù…Ø±Ø§ÙÙ‚ Ø·ÙˆØ§Ù„ Ø§Ù„Ø¬ÙˆÙ„Ø© ÙÙŠ Ø§Ù„Ù…ØºØ±Ø¨',
          'Ø¥Ù‚Ø§Ù…Ø© 4 Ù„ÙŠØ§Ù„Ù ÙÙŠ Ø§Ù„ÙÙ†Ø¯Ù‚ Ø¨Ù†Ø¸Ø§Ù… Ø§Ù„Ø¥Ù‚Ø§Ù…Ø© Ø§Ù„ÙƒØ§Ù…Ù„Ø© Ø¬Ø²Ø¦ÙŠØ§Ù‹ (3 ÙˆØ¬Ø¨Ø§Øª Ø¹Ø´Ø§Ø¡ + 1 ÙˆØ¬Ø¨Ø© ØºØ¯Ø§Ø¡)',
          'Ø§Ù„Ø²ÙŠØ§Ø±Ø§Øª Ø§Ù„Ù…Ø°ÙƒÙˆØ±Ø© ÙÙŠ Ø§Ù„Ø¨Ø±Ù†Ø§Ù…Ø¬',
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
          'Billetes de ferry Tarifa / TÃ¡nger / Tarifa',
          'Transporte en Marruecos',
          'GuÃ­a acompaÃ±ante en el tour en Marruecos',
          '4 noches de hotel en rÃ©gimen de media pensiÃ³n (3 cenas + 1 almuerzo)',
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
          'Bilhetes de ferry Tarifa / TÃ¢nger / Tarifa',
          'Transporte em Marrocos',
          'Guia acompanhante no tour em Marrocos',
          '4 noites de hotel em regime de meia-pensÃ£o (3 jantares + 1 almoÃ§o)',
          'Visitas mencionadas no programa',
        ],
      },
      excludedServicesJsonb: {
        ar: ['ØªØ£Ø´ÙŠØ±Ø© Ø¯Ø®ÙˆÙ„ Ø§Ù„Ù…ØºØ±Ø¨', 'Ø¥ÙƒØ±Ø§Ù…ÙŠØ§Øª Ø§Ù„Ø³ÙØ± ÙˆØ§Ù„Ù…Ø³Ø§Ø¹Ø¯Ø©'],
        en: ['Entry visa to Morocco', 'Travel tips and assistance'],
        es: ['Visado de entrada a Marruecos', 'Propinas de viaje y asistencia'],
        it: ['Visto d\'ingresso in Marocco', 'Mance di viaggio e assistenza'],
        pt: ['Visto de entrada em Marrocos', 'Gorjetas de viagem e assistÃªncia'],
      },
      itineraries: [
        {
          dayLabel: 'Day 1',
          descriptionJsonb: {
            ar: 'Ø§Ù„Ù†Ù‚Ù„ Ù…Ù† Ù†Ù‚Ø§Ø· Ø§Ù„ØªØ¬Ù…Ø¹ Ø§Ù„Ù…Ø®ØªÙ„ÙØ© ÙÙŠ ÙƒÙˆØ³ØªØ§ Ø¯ÙŠÙ„ Ø³ÙˆÙ„ Ù†Ø­Ùˆ Ø·Ø±ÙŠÙØ©. Ø±ÙƒÙˆØ¨ Ø§Ù„Ø¹Ø¨Ø§Ø±Ø© Ù…Ù† Ø·Ø±ÙŠÙØ© Ù†Ø­Ùˆ Ø·Ù†Ø¬Ø©. Ø¹Ù†Ø¯ Ø§Ù„ÙˆØµÙˆÙ„ØŒ ÙŠÙƒÙˆÙ† ÙÙŠ Ø§Ù„Ø§Ø³ØªÙ‚Ø¨Ø§Ù„ Ù…Ø±Ø´Ø¯Ù†Ø§ Ø§Ù„Ù…ØºØ±Ø¨ÙŠ Ø§Ù„Ø°ÙŠ Ø³ÙŠØ±Ø§ÙÙ‚ Ø§Ù„Ø±Ø­Ù„Ø© Ø·ÙˆØ§Ù„ Ø§Ù„Ø¬ÙˆÙ„Ø©. Ø§Ù„ØªØ­Ø±Ùƒ Ù†Ø­Ùˆ Ù…Ø¯ÙŠÙ†Ø© Ù…ÙƒÙ†Ø§Ø³ Ø§Ù„Ø¥Ù…Ø¨Ø±Ø§Ø·ÙˆØ±ÙŠØ©ØŒ Ù„Ø¥Ø¬Ø±Ø§Ø¡ Ø¬ÙˆÙ„Ø© Ø¨Ø§Ù†ÙˆØ±Ø§Ù…ÙŠØ© Ù„Ù„Ù…Ø¯ÙŠÙ†Ø© ÙˆÙ„Ø£Ø³ÙˆØ§Ø± Ø¨Ø§Ø¨ Ø§Ù„Ù…Ù†ØµÙˆØ±. Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø© Ù†Ø­Ùˆ ÙØ§Ø³. Ø§Ù„ÙˆØµÙˆÙ„ ÙÙŠ Ø£ÙˆØ§Ø®Ø± ÙØªØ±Ø© Ø¨Ø¹Ø¯ Ø§Ù„Ø¸Ù‡Ø±. Ø§Ù„Ø¹Ø´Ø§Ø¡ ÙˆØ§Ù„Ø¥Ù‚Ø§Ù…Ø© ÙÙŠ Ø§Ù„ÙÙ†Ø¯Ù‚.\n\nÙ…Ù„Ø§Ø­Ø¸Ø© Ù‡Ø§Ù…Ø©: ØªØ®Ø¶Ø¹ Ù…Ø¯ÙŠÙ†Ø© Ù…ÙƒÙ†Ø§Ø³ Ø­Ø§Ù„ÙŠØ§Ù‹ Ù„Ø£Ø¹Ù…Ø§Ù„ ØªØ¬Ø¯ÙŠØ¯ØŒ Ù…Ù…Ø§ ÙŠØ¬Ø¹Ù„ Ø²ÙŠØ§Ø±ØªÙ‡Ø§ Ø£Ù…Ø±Ø§Ù‹ Ù…Ø³ØªØ­ÙŠÙ„Ø§Ù‹ Ù†Ø¸Ø±Ø§Ù‹ Ù„Ù„Ø¹Ø¯Ø¯ Ø§Ù„ÙƒØ¨ÙŠØ± Ù…Ù† Ø§Ù„Ø£Ø¹Ù…Ø§Ù„ Ø§Ù„Ù‡Ø§Ù…Ø© Ø§Ù„ØªÙŠ ÙŠØªÙ… ØªÙ†ÙÙŠØ°Ù‡Ø§.',
            en: 'Transfer from the different pick-up points in Costa del Sol towards Tarifa. Boarding the ferry from Tarifa towards Tangier. Upon arrival, our Moroccan guide awaits, who will accompany the group throughout the tour. Departure to the imperial city of Meknes, for a panoramic tour of the city and the walls of Bab el Mansour. Continuation to Fez. Arrival in the late afternoon. Dinner and accommodation at the hotel.\n\nIMPORTANT NOTE: Currently, the city of Meknes is undergoing remodeling, which makes it impossible to visit due to the large number of major works being carried out.',
            es: 'Traslado desde los diferentes puntos de recogida de Costa del Sol hacia Tarifa. Embarque en ferry desde Tarifa hacia TÃ¡nger. A la llegada, espera nuestro guÃ­a marroquÃ­ que acompaÃ±a durante todo el recorrido. Salida hacia la ciudad imperial de Meknes, para hacer una visita panorÃ¡mica de la ciudad y de las murallas de Bab el Mansour. ContinuaciÃ³n hacia Fez. Llegada al final de la tarde. Cena y alojamiento en el hotel.\n\nNOTA IMPORTANTE: Actualmente la ciudad de Meknes se encuentra en remodelaciÃ³n, lo que hace que sea imposible poder visitarla debido a la gran cantidad de obras importantes que se estÃ¡n realizando.',
            it: 'Trasferimento dai diversi punti di raccolta della Costa del Sol verso Tarifa. Imbarco sul traghetto da Tarifa verso Tangeri. All\'arrivo, accoglienza da parte della nostra guida marocchina che accompagnerÃ  il gruppo per tutto il viaggio. Partenza verso la cittÃ  imperiale di Meknes, per una visita panoramica della cittÃ  e delle mura di Bab el Mansour. Proseguimento verso Fez. Arrivo nel tardo pomeriggio. Cena e pernottamento in hotel.\n\nNOTA IMPORTANTE: Attualmente la cittÃ  di Meknes Ã¨ in fase di ristrutturazione, il che rende impossibile visitarla a causa del gran numero di importanti lavori in corso.',
            pt: 'Translado dos diferentes pontos de recolha da Costa del Sol em direÃ§Ã£o a Tarifa. Embarque em ferry de Tarifa em direÃ§Ã£o a TÃ¢nger. Ã€ chegada, espera-nos o nosso guia marroquino que acompanharÃ¡ durante todo o percurso. SaÃ­da em direÃ§Ã£o Ã  cidade imperial de Meknes, para fazer uma visita panorÃ¢mica da cidade e das muralhas de Bab el Mansour. ContinuaÃ§Ã£o em direÃ§Ã£o a Fez. Chegada ao final da tarde. Jantar e alojamento no hotel.\n\nNOTA IMPORTANTE: Atualmente a cidade de Meknes encontra-se em remodelaÃ§Ã£o, o que torna impossÃ­vel visitÃ¡-la devido Ã  grande quantidade de obras importantes que estÃ£o a ser realizadas.',
          },
          mealsJsonb: { ar: 'Ø¹Ø´Ø§Ø¡', en: 'Dinner', es: 'Cena', it: 'Cena', pt: 'Jantar' },
          sortOrder: 0,
        },
        {
          dayLabel: 'Day 2',
          descriptionJsonb: {
            ar: 'Ø§Ù„Ø¥ÙØ·Ø§Ø±. Ø²ÙŠØ§Ø±Ø© ÙƒØ§Ù…Ù„Ø© Ù„Ù„Ù…Ø¯ÙŠÙ†Ø© Ø§Ù„ØªÙŠ ØªØ¹ØªØ¨Ø± Ø§Ù„Ø¹Ø§ØµÙ…Ø© Ø§Ù„Ø¯ÙŠÙ†ÙŠØ© Ù„Ù„Ø¨Ù„Ø§Ø¯. ØªØ£Ø³Ø³Øª ÙÙŠ Ø§Ù„Ù‚Ø±Ù† Ø§Ù„Ø«Ø§Ù…Ù† Ø¹Ù„Ù‰ ÙŠØ¯ Ø¥Ø¯Ø±ÙŠØ³ Ø§Ù„Ø«Ø§Ù†ÙŠØŒ ÙˆØªØ¹ØªØ¨Ø± ÙˆØ§Ø­Ø¯Ø© Ù…Ù† Ø§Ù„Ø¹ÙˆØ§ØµÙ… Ø§Ù„Ø¥Ù…Ø¨Ø±Ø§Ø·ÙˆØ±ÙŠØ© Ø§Ù„Ø£Ø±Ø¨Ø¹ Ù„Ù„Ù…ØºØ±Ø¨. Ø®Ù„Ø§Ù„ Ù‡Ø°Ù‡ Ø§Ù„Ø²ÙŠØ§Ø±Ø©ØŒ ÙŠØªÙ… Ø¥Ø¬Ø±Ø§Ø¡ Ø¬ÙˆÙ„Ø© ÙÙŠ Ø§Ù„Ø£Ù…Ø§ÙƒÙ† Ø§Ù„Ø£ÙƒØ«Ø± ØªÙ…ÙŠØ²Ø§Ù‹ Ù…Ø«Ù„ Ø§Ù„ØªØµÙ…ÙŠÙ… Ø§Ù„Ø®Ø§Ø±Ø¬ÙŠ Ù„Ù„Ù‚ØµØ± Ø§Ù„Ù…Ù„ÙƒÙŠØŒ Ø§Ù„Ø­ÙŠ Ø§Ù„ÙŠÙ‡ÙˆØ¯ÙŠØŒ ÙˆØ§Ù„Ù‚Ù„Ø¹Ø© Ø§Ù„ØªÙŠ ØªØªÙ…ØªØ¹ Ø¨Ø£ÙØ¶Ù„ Ø¥Ø·Ù„Ø§Ù„Ø© Ø¹Ù„Ù‰ ÙØ§Ø³ Ø§Ù„Ø¨Ø§Ù„ÙŠ. Ø§Ù„Ø¹Ø´Ø§Ø¡ ÙˆØ§Ù„Ø¥Ù‚Ø§Ù…Ø© ÙÙŠ Ø§Ù„ÙÙ†Ø¯Ù‚.',
            en: 'Breakfast. Full visit of the city considered the religious capital of the country. Founded in the 8th century by Idriss II, it is considered one of the 4 imperial capitals of Morocco. During this visit, a tour is made of the most emblematic places such as the exterior of the Royal Palace, the Jewish quarter, and the fortress. Dinner and accommodation at the hotel.',
            es: 'Desayuno. Visita completa de la ciudad considerada la capital religiosa del paÃ­s. Fundada en el siglo VIII por Idriss II. Durante esta visita se realiza un recorrido por los lugares mÃ¡s emblemÃ¡ticos como los exteriores del Palacio Real, el barrio judÃ­o y la fortaleza. Cena y alojamiento en el hotel.',
            it: 'Colazione. Visita completa della cittÃ  considerata la capitale religiosa del paese. Fondata nell\'VIII secolo da Idriss II. Durante questa visita si effettuerÃ  un tour dei luoghi piÃ¹ emblematici come l\'esterno del Palazzo Reale, il quartiere ebraico e la fortezza. Cena e pernottamento in hotel.',
            pt: 'Pequeno-almoÃ§o. Visita completa da cidade considerada a capital religiosa do paÃ­s. Fundada no sÃ©culo VIII por Idriss II. Durante esta visita realiza-se um percurso pelos locais mais emblemÃ¡ticos como o exterior do PalÃ¡cio Real, o bairro judeu e a fortaleza. Jantar e alojamento no hotel.',
          },
          mealsJsonb: { ar: 'Ø¥ÙØ·Ø§Ø± + Ø¹Ø´Ø§Ø¡', en: 'Breakfast + Dinner', es: 'Desayuno + Cena', it: 'Colazione + Cena', pt: 'Pequeno-almoÃ§o + Jantar' },
          sortOrder: 1,
        },
        {
          dayLabel: 'Day 3',
          descriptionJsonb: {
            ar: 'Ø§Ù„Ø¥ÙØ·Ø§Ø±. Ø§Ù„Ù…ØºØ§Ø¯Ø±Ø© Ù…Ø¨ÙƒØ±Ø§Ù‹ Ù†Ø­Ùˆ Ø§Ù„Ø±Ø¨Ø§Ø·ØŒ Ø¹Ø§ØµÙ…Ø© Ø§Ù„Ø¨Ù„Ø§Ø¯ØŒ Ù„Ø²ÙŠØ§Ø±Ø© Ø§Ù„Ø£Ù…Ø§ÙƒÙ† Ø§Ù„Ø£ÙƒØ«Ø± ØªÙ…ÙŠØ²Ø§Ù‹ ÙÙŠ Ù‡Ø°Ù‡ Ø§Ù„Ù…Ø¯ÙŠÙ†Ø© Ù…Ø«Ù„ Ø§Ù„ØªØµÙ…ÙŠÙ… Ø§Ù„Ø®Ø§Ø±Ø¬ÙŠ Ù„Ù„Ù‚ØµØ± Ø§Ù„Ù…Ù„ÙƒÙŠØŒ Ø¶Ø±ÙŠØ­ Ù…Ø­Ù…Ø¯ Ø§Ù„Ø®Ø§Ù…Ø³ØŒ ÙˆØµÙˆÙ…Ø¹Ø© Ø­Ø³Ø§Ù†. Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø© Ù†Ø­Ùˆ Ø§Ù„Ø¯Ø§Ø± Ø§Ù„Ø¨ÙŠØ¶Ø§Ø¡ Ù„Ø²ÙŠØ§Ø±Ø© Ø³Ø§Ø­Ø© Ø§Ù„Ø£Ù…Ù… Ø§Ù„Ù…ØªØ­Ø¯Ø©ØŒ ÙƒÙˆØ±Ù†ÙŠØ´ Ø¹ÙŠÙ† Ø§Ù„Ø°Ø¦Ø§Ø¨ØŒ ÙˆØ§Ù„ØªØµÙ…ÙŠÙ… Ø§Ù„Ø®Ø§Ø±Ø¬ÙŠ Ù„Ù…Ø³Ø¬Ø¯ Ø§Ù„Ø­Ø³Ù† Ø§Ù„Ø«Ø§Ù†ÙŠ. ÙˆÙ‚Øª Ø­Ø± Ù„Ù„ØºØ¯Ø§Ø¡ Ø«Ù… Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø© Ù†Ø­Ùˆ Ù…Ø±Ø§ÙƒØ´. Ø§Ù„Ø¥Ù‚Ø§Ù…Ø© ÙÙŠ Ø§Ù„ÙÙ†Ø¯Ù‚.',
            en: 'Breakfast. Early departure to Rabat, capital of the country, to visit the Royal Palace exterior, Mausoleum of Mohamed V, and Hassan Tower. Continuation to Casablanca to visit United Nations Square, Boulevard de la Corniche, and Hassan II Mosque exterior. Free time for lunch en route and continuation to Marrakech. Accommodation at hotel.',
            es: 'Desayuno. Salida temprano hacia Rabat, capital del paÃ­s, para visitar los exteriores del palacio real, el Mausoleo de Mohamed V y la torre Hassan. ContinuaciÃ³n hacia Casablanca para visitar la plaza de las Naciones Unidas, el Boulevard de la Corniche y los exteriores de la mezquita de Hassan II. Almuerzo libre en ruta y continuaciÃ³n hacia Marrakech. Alojamiento en el hotel.',
            it: 'Colazione. Partenza verso Rabat per visitare l\'esterno del palazzo reale, il Mausoleo di Mohamed V e la torre Hassan. Proseguimento verso Casablanca per visitare la piazza delle Nazioni Unite, il Boulevard de la Corniche e l\'esterno della moschea di Hassan II. Pranzo libero e proseguimento verso Marrakech. Pernottamento in hotel.',
            pt: 'Pequeno-almoÃ§o. SaÃ­da em direÃ§Ã£o a Rabat para visitar o exterior do palÃ¡cio real, o MausolÃ©u de Mohamed V e a torre Hassan. ContinuaÃ§Ã£o em direÃ§Ã£o a Casablanca para visitar a PraÃ§a das NaÃ§Ãµes Unidas, o Boulevard de la Corniche e o exterior da mesquita de Hassan II. AlmoÃ§o livre e continuaÃ§Ã£o para Marraquexe. Alojamento no hotel.',
          },
          mealsJsonb: { ar: 'Ø¥ÙØ·Ø§Ø±', en: 'Breakfast', es: 'Desayuno', it: 'Colazione', pt: 'Pequeno-almoÃ§o' },
          sortOrder: 2,
        },
        {
          dayLabel: 'Day 4',
          descriptionJsonb: {
            ar: 'Ø§Ù„Ø¥ÙØ·Ø§Ø±. Ø²ÙŠØ§Ø±Ø© Ù…Ø¯ÙŠÙ†Ø© Ù…Ø±Ø§ÙƒØ´: Ø­Ø¯Ø§Ø¦Ù‚ Ø§Ù„Ù…Ù†Ø§Ø±Ø©ØŒ Ù…Ø¦Ø°Ù†Ø© Ø§Ù„ÙƒØªØ¨ÙŠØ©ØŒ ÙˆÙ‚ØµØ± Ø§Ù„Ø¨Ø§Ù‡ÙŠØ©. Ø§Ù„ÙˆØµÙˆÙ„ Ø¥Ù„Ù‰ Ø³Ø§Ø­Ø© Ø¬Ø§Ù…Ø¹ Ø§Ù„ÙÙ†Ø§Ø¡ ÙˆØ§Ù„Ø¯Ø®ÙˆÙ„ Ø¥Ù„Ù‰ Ø§Ù„Ø£Ø³ÙˆØ§Ù‚ ÙˆØ§Ù„Ù…Ø¯ÙŠÙ†Ø© Ø§Ù„Ù‚Ø¯ÙŠÙ…Ø©. Ø§Ù„ØºØ¯Ø§Ø¡ ÙÙŠ ÙÙ†Ø¯Ù‚ Ø¨Ù…Ø±Ø§ÙƒØ´ Ø«Ù… Ø§Ù„Ù…ØºØ§Ø¯Ø±Ø© Ù†Ø­Ùˆ Ø§Ù„Ø¯Ø§Ø± Ø§Ù„Ø¨ÙŠØ¶Ø§Ø¡. Ø§Ù„Ø¹Ø´Ø§Ø¡ ÙˆØ§Ù„Ø¥Ù‚Ø§Ù…Ø© ÙÙŠ Ø§Ù„ÙÙ†Ø¯Ù‚.',
            en: 'Breakfast. Visit Marrakech: Menara Gardens, Koutoubia minaret exterior, Bahia Palace, and Jemaa el Fna square. Lunch at hotel in Marrakech and departure to Casablanca. Dinner and accommodation at hotel.',
            es: 'Desayuno. Visita de Marrakech: Jardines de la Menara, minarete de la Koutoubia, Palacio de la BahÃ­a y plaza de Jemaa el Fna. Almuerzo en hotel de Marrakech y posterior salida hacia Casablanca. Cena y alojamiento en el hotel.',
            it: 'Colazione. Visita di Marrakech: Giardini della Menara, minareto della Koutoubia, Palazzo della Bahia e piazza Jemaa el Fna. Pranzo in hotel a Marrakech e partenza verso Casablanca. Cena e pernottamento in hotel.',
            pt: 'Pequeno-almoÃ§o. Visita de Marraquexe: Jardins da Menara, minarete da Koutoubia, PalÃ¡cio da Bahia e praÃ§a de Jemaa el Fna. AlmoÃ§o no hotel em Marraquexe e saÃ­da para Casablanca. Jantar e alojamento no hotel.',
          },
          mealsJsonb: { ar: 'Ø¥ÙØ·Ø§Ø± + ØºØ¯Ø§Ø¡ + Ø¹Ø´Ø§Ø¡', en: 'Breakfast + Lunch + Dinner', es: 'Desayuno + Almuerzo + Cena', it: 'Colazione + Pranzo + Cena', pt: 'Pequeno-almoÃ§o + AlmoÃ§o + Jantar' },
          sortOrder: 3,
        },
        {
          dayLabel: 'Day 5',
          descriptionJsonb: {
            ar: 'Ø§Ù„Ø¥ÙØ·Ø§Ø±. Ø§Ù„Ù…ØºØ§Ø¯Ø±Ø© Ù†Ø­Ùˆ Ø·Ù†Ø¬Ø© ÙˆØ§Ù„Ù†Ù‚Ù„ Ø¥Ù„Ù‰ Ø§Ù„Ù…ÙŠÙ†Ø§Ø¡ Ù„Ù„Ù…ØºØ§Ø¯Ø±Ø© Ø¨Ø§Ù„Ø¹Ø¨Ø§Ø±Ø© Ù†Ø­Ùˆ Ø·Ø±ÙŠÙØ©. Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø© Ù†Ø­Ùˆ ÙƒÙˆØ³ØªØ§ Ø¯ÙŠÙ„ Ø³ÙˆÙ„ ÙˆØ§Ù„Ù†Ù‚Ù„ Ù„Ù„Ù…Ø·Ø§Ø± Ù„Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„ÙˆØ·Ù†.',
            en: 'Breakfast. Departure to Tangier and transfer to the port for ferry departure to Tarifa. Continuation to Costa del Sol and airport transfer for return flight.',
            es: 'Desayuno. Salida hacia TÃ¡nger y traslado al puerto para salida en ferry hacia Tarifa. ContinuaciÃ³n hacia Costa del Sol y traslado al aeropuerto.',
            it: 'Colazione. Partenza verso Tangeri e trasferimento al porto per il traghetto per Tarifa. Proseguimento verso la Costa del Sol e trasferimento in aeroporto.',
            pt: 'Pequeno-almoÃ§o. SaÃ­da para TÃ¢nger e translado para o porto para saÃ­da em ferry para Tarifa. ContinuaÃ§Ã£o para a Costa del Sol e translado para o aeroporto.',
          },
          mealsJsonb: { ar: 'Ø¥ÙØ·Ø§Ø±', en: 'Breakfast', es: 'Desayuno', it: 'Colazione', pt: 'Pequeno-almoÃ§o' },
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
        ar: 'Ø§Ù„Ù‚Ø§Ù‡Ø±Ø© Ø§ÙƒØ³Ø¨Ø±Ø³',
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
        ar: '4 Ø£ÙŠØ§Ù… / 3 Ù„ÙŠØ§Ù„Ù',
        en: '4 Days / 3 Nights',
        es: '4 DÃ­as / 3 Noches',
        it: '4 Giorni / 3 Notti',
      },
      overviewJsonb: {
        pt: 'Roteiro intenso de quatro dias explorando o coraÃ§Ã£o do Egito Antigo. Visite as PirÃ¢mides de Giza, a Esfinge, Memphis, Sakkara, o Grand Egyptian Museum, a Mesquita de Alabastro e o vibrante Mercado Khan El Khalili. Pacote completo com traslados, hospedagem e visto inclusos.',
        ar: 'Ø¨Ø±Ù†Ø§Ù…Ø¬ Ù…ÙƒØ«Ù Ù„Ù…Ø¯Ø© Ø£Ø±Ø¨Ø¹Ø© Ø£ÙŠØ§Ù… Ù„Ø§Ø³ØªÙƒØ´Ø§Ù Ù‚Ù„Ø¨ Ù…ØµØ± Ø§Ù„Ù‚Ø¯ÙŠÙ…Ø©. Ø²ÙŠØ§Ø±Ø© Ø£Ù‡Ø±Ø§Ù…Ø§Øª Ø§Ù„Ø¬ÙŠØ²Ø©ØŒ Ø£Ø¨Ùˆ Ø§Ù„Ù‡ÙˆÙ„ØŒ Ù…Ù…ÙÙŠØ³ØŒ Ø³Ù‚Ø§Ø±Ø©ØŒ Ø§Ù„Ù…ØªØ­Ù Ø§Ù„Ù…ØµØ±ÙŠ Ø§Ù„ÙƒØ¨ÙŠØ±ØŒ Ù…Ø³Ø¬Ø¯ Ø§Ù„Ø£Ù„Ø¨Ø§Ø³ØªØ±ØŒ ÙˆØ³ÙˆÙ‚ Ø®Ø§Ù† Ø§Ù„Ø®Ù„ÙŠÙ„ÙŠ Ø§Ù„Ù†Ø§Ø¨Ø¶ Ø¨Ø§Ù„Ø­ÙŠØ§Ø©. Ø¨Ø§Ù‚Ø© ÙƒØ§Ù…Ù„Ø© ØªØ´Ù…Ù„ Ø§Ù„ØªÙˆØµÙŠÙ„Ø§ØªØŒ Ø§Ù„Ø¥Ù‚Ø§Ù…Ø©ØŒ ÙˆØ§Ù„ØªØ£Ø´ÙŠØ±Ø©.',
        en: 'An intense 4-day itinerary exploring the heart of Ancient Egypt. Visit the Pyramids of Giza, the Sphinx, Memphis, Saqqara, the Grand Egyptian Museum, the Alabaster Mosque, and the vibrant Khan El Khalili market. Complete package with transfers, accommodation, and visa included.',
        es: 'Un itinerario intenso de 4 dÃ­as explorando el corazÃ³n del Antiguo Egipto. Visita las PirÃ¡mides de Guiza, la Esfinge, Menfis, Saqqara, el Gran Museo Egipcio, la Mezquita de Alabastro y el vibrante Mercado Khan El Khalili.',
        it: 'Un intenso itinerario di 4 giorni alla scoperta del cuore dell\'Antico Egitto. Visita le Piramidi di Giza, la Sfinge, Menfi, Saqqara, il Grand Egyptian Museum, la Moschea di Alabastro e il mercato di Khan El Khalili.',
      },
      includedServicesJsonb: {
        pt: [
          '03 noites de hospedagem no Cairo em hotel de categoria escolhida com cafÃ© da manhÃ£ e taxas',
          'Traslados: Aeroporto / Hotel / Aeroporto em serviÃ§o regular.',
          'AssistÃªncia no Aeroporto conforme roteiro',
          'Passeio no Cairo Ã s PirÃ¢mides e Esfinge, Memphis e Sakkara, Mastabas e PirÃ¢mide de Teti',
          'Passeio e entrada ao Grand Egyptian Museum, Mesquita, Bairro Copta e Mercado Khan El Khalili',
        ],
        ar: [
          'Ø¥Ù‚Ø§Ù…Ø© Ù„Ù…Ø¯Ø© 03 Ù„ÙŠØ§Ù„Ù ÙÙŠ Ø§Ù„Ù‚Ø§Ù‡Ø±Ø© Ø¨Ø§Ù„ÙÙ†Ø¯Ù‚ Ø§Ù„Ù…Ø®ØªØ§Ø± Ù…Ø¹ Ø§Ù„Ø¥ÙØ·Ø§Ø± ÙˆØ§Ù„Ø¶Ø±Ø§Ø¦Ø¨',
          'Ø§Ù„Ø§Ù†ØªÙ‚Ø§Ù„Ø§Øª: Ø§Ù„Ù…Ø·Ø§Ø± / Ø§Ù„ÙÙ†Ø¯Ù‚ / Ø§Ù„Ù…Ø·Ø§Ø± Ø¨Ø´Ø±ÙƒØ§Øª Ø®Ø¯Ù…Ø© Ù…Ù†ØªØ¸Ù…Ø©',
          'Ø§Ù„Ù…Ø³Ø§Ø¹Ø¯Ø© Ø¨Ø§Ù„Ù…Ø·Ø§Ø± Ø­Ø³Ø¨ Ø®Ø·Ø© Ø§Ù„Ø³ÙŠØ±',
          'Ø¬ÙˆÙ„Ø© Ø§Ù„Ù‚Ø§Ù‡Ø±Ø© Ø¥Ù„Ù‰ Ø§Ù„Ø£Ù‡Ø±Ø§Ù…Ø§Øª ÙˆØ£Ø¨Ùˆ Ø§Ù„Ù‡ÙˆÙ„ØŒ Ù…Ù…ÙÙŠØ³ ÙˆØ³Ù‚Ø§Ø±Ø©ØŒ Ø§Ù„Ù…ØµØ§Ø·Ø¨ ÙˆÙ‡Ø±Ù… ØªÙŠØªÙŠ',
          'Ø¬ÙˆÙ„Ø© ÙˆØ¯Ø®ÙˆÙ„ Ø§Ù„Ù…ØªØ­Ù Ø§Ù„Ù…ØµØ±ÙŠ Ø§Ù„ÙƒØ¨ÙŠØ±ØŒ Ø§Ù„Ù…Ø³Ø¬Ø¯ØŒ Ø§Ù„Ø­ÙŠ Ø§Ù„Ù‚Ø¨Ø·ÙŠØŒ ÙˆØ³ÙˆÙ‚ Ø®Ø§Ù† Ø§Ù„Ø®Ù„ÙŠÙ„ÙŠ',
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
          'Todas as bebidas durante o almoÃ§o e jantar nos passeios nÃ£o estÃ£o inclusas',
          'Gorjetas aos maleteiros e carregadores obrigatÃ³rias',
          'Visto obrigatÃ³rio 35$ pp, um representante lhe aguardando no desembarque para lhe entregar o visto e lhe auxiliar na imigraÃ§Ã£o',
        ],
        ar: [
          'Ø¬Ù…ÙŠØ¹ Ø§Ù„Ù…Ø´Ø±ÙˆØ¨Ø§Øª Ø£Ø«Ù†Ø§Ø¡ ÙˆØ¬Ø¨ØªÙŠ Ø§Ù„ØºØ¯Ø§Ø¡ ÙˆØ§Ù„Ø¹Ø´Ø§Ø¡ ÙÙŠ Ø§Ù„Ø¬ÙˆÙ„Ø§Øª ØºÙŠØ± Ø´Ø§Ù…Ù„Ø©',
          'Ø¥ÙƒØ±Ø§Ù…ÙŠØ§Øª Ø­Ø§Ù…Ù„ÙŠ Ø§Ù„Ø­Ù‚Ø§Ø¦Ø¨ ÙˆØ§Ù„Ø´ÙŠØ§Ù„ÙŠÙ† Ø¥Ø¬Ø¨Ø§Ø±ÙŠØ©',
          'Ø§Ù„ØªØ£Ø´ÙŠØ±Ø© Ø§Ù„Ø¥Ø¬Ø¨Ø§Ø±ÙŠØ© 35$ Ù„Ù„Ø´Ø®ØµØŒ Ù…Ù…Ø«Ù„ Ø¨Ø§Ù†ØªØ¸Ø§Ø±Ùƒ Ø¹Ù†Ø¯ Ø§Ù„ÙˆØµÙˆÙ„ Ù„ØªØ³Ù„ÙŠÙ… Ø§Ù„ØªØ£Ø´ÙŠØ±Ø© ÙˆØ§Ù„Ù…Ø³Ø§Ø¹Ø¯Ø© ÙÙŠ Ø§Ù„Ø¬ÙˆØ§Ø²Ø§Øª',
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
            pt: 'Chegada no Aeroporto Internacional do Cairo. Traslado para o Hotel. Conforme o horÃ¡rio de chegada Ã© possÃ­vel oferecer algum passeio opcional.',
            ar: 'Ø§Ù„ÙˆØµÙˆÙ„ Ø¥Ù„Ù‰ Ù…Ø·Ø§Ø± Ø§Ù„Ù‚Ø§Ù‡Ø±Ø© Ø§Ù„Ø¯ÙˆÙ„ÙŠ ÙˆØ§Ù„Ù†Ù‚Ù„ Ø¥Ù„Ù‰ Ø§Ù„ÙÙ†Ø¯Ù‚. Ø­Ø³Ø¨ ÙˆÙ‚Øª Ø§Ù„ÙˆØµÙˆÙ„ØŒ ÙŠÙ…ÙƒÙ† ØªÙ‚Ø¯ÙŠÙ… Ø¨Ø¹Ø¶ Ø§Ù„Ø¬ÙˆÙ„Ø§Øª Ø§Ù„Ø§Ø®ØªÙŠØ§Ø±ÙŠØ©.',
            en: 'Arrival at Cairo International Airport and transfer to Hotel. Optional tours available depending on arrival time.',
            es: 'Llegada al Aeropuerto Internacional del Cairo y traslado al Hotel.',
            it: 'Arrivo all\'Aeroporto Internazionale del Cairo e trasferimento in Hotel.',
          },
          sortOrder: 0,
        },
        {
          dayLabel: 'Day 2',
          descriptionJsonb: {
            pt: 'PirÃ¢mides, Esfinge, FÃ¡brica de Papiros, Memphis e Sakkara. CafÃ© da manhÃ£ no hotel e saÃ­da para visita Ã s pirÃ¢mides de Giza: QuÃ©ops, Quefren e Miquerinos. Mirante das PirÃ¢mides, Esfinge, Memphis, PirÃ¢mide de Djoser, almoÃ§o em restaurante local, mastabas, PirÃ¢mide de Teti e fÃ¡brica de papiros. Retorno ao hotel.',
            ar: 'Ø§Ù„Ø£Ù‡Ø±Ø§Ù…Ø§ØªØŒ Ø£Ø¨Ùˆ Ø§Ù„Ù‡ÙˆÙ„ØŒ Ù…ØµÙ†Ø¹ Ø§Ù„Ø¨Ø±Ø¯ÙŠØŒ Ù…Ù…ÙÙŠØ³ ÙˆØ³Ù‚Ø§Ø±Ø©. Ø§Ù„Ø¥ÙØ·Ø§Ø± Ø¨Ø§Ù„ÙÙ†Ø¯Ù‚ ÙˆØ§Ù„Ø§Ù†Ø·Ù„Ø§Ù‚ Ù„Ø²ÙŠØ§Ø±Ø© Ø£Ù‡Ø±Ø§Ù…Ø§Øª Ø§Ù„Ø¬ÙŠØ²Ø©: Ø®ÙˆÙÙˆØŒ Ø®ÙØ±Ø¹ØŒ ÙˆÙ…Ù†Ù‚Ø±Ø¹. Ø§Ù„Ø¨Ø§Ù†ÙˆØ±Ø§Ù…Ø§ØŒ Ø²ÙŠØ§Ø±Ø© Ø£Ø¨Ùˆ Ø§Ù„Ù‡ÙˆÙ„ØŒ Ù…Ù…ÙÙŠØ³ ÙˆØ³Ù‚Ø§Ø±Ø©ØŒ Ù‡Ø±Ù… Ø²ÙˆØ³Ø±ØŒ Ø§Ù„ØºØ¯Ø§Ø¡ Ø¨Ù…Ø·Ø¹Ù… Ù…Ø­Ù„ÙŠØŒ Ø§Ù„Ù…ØµØ§Ø·Ø¨ØŒ Ù‡Ø±Ù… ØªÙŠØªÙŠØŒ ÙˆÙ…ØµÙ†Ø¹ Ø§Ù„Ø¨Ø±Ø¯ÙŠ. Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„ÙÙ†Ø¯Ù‚.',
            en: 'Pyramids, Sphinx, Papyrus Factory, Memphis and Saqqara. Breakfast at hotel and departure to visit Giza Pyramids: Khufu, Khafre, and Menkaure. Panoramic view, Sphinx visit, Memphis, Djoser Step Pyramid, local restaurant lunch, Mastabas, Teti Pyramid, and papyrus factory stop.',
            es: 'PirÃ¡mides de Guiza, Esfinge, FÃ¡brica de Papiros, Menfis y Saqqara. Almuerzo incluido.',
            it: 'Piramidi di Giza, Sfinge, Fabbrica di Papiri, Menfi e Saqqara. Pranzo incluso.',
          },
          sortOrder: 1,
        },
        {
          dayLabel: 'Day 3',
          descriptionJsonb: {
            pt: 'Novo Museu (GEM), Mesquita de Alabastro, Mercado Khan El Khalili. CafÃ© da manhÃ£ no hotel e saÃ­da para a visita ao Novo Museu, Mesquita de Alabastro e Cidadela de Saladino, passeio a pÃ© pelo Bairro Copta e ao mercado Khan El Khalili. AlmoÃ§o em restaurante local. Retorno para o hotel.',
            ar: 'Ø§Ù„Ù…ØªØ­Ù Ø§Ù„Ø¬Ø¯ÙŠØ¯ (GEM)ØŒ Ù…Ø³Ø¬Ø¯ Ø§Ù„Ø£Ù„Ø¨Ø§Ø³ØªØ±ØŒ Ø³ÙˆÙ‚ Ø®Ø§Ù† Ø§Ù„Ø®Ù„ÙŠÙ„ÙŠ. Ø§Ù„Ø¥ÙØ·Ø§Ø± Ø¨Ø§Ù„ÙÙ†Ø¯Ù‚ ÙˆØ§Ù„Ø§Ù†Ø·Ù„Ø§Ù‚ Ù„Ø²ÙŠØ§Ø±Ø© Ø§Ù„Ù…ØªØ­Ù Ø§Ù„Ø¬Ø¯ÙŠØ¯ØŒ Ù…Ø³Ø¬Ø¯ Ø§Ù„Ø£Ù„Ø¨Ø§Ø³ØªØ±ØŒ Ù‚Ù„Ø¹Ø© ØµÙ„Ø§Ø­ Ø§Ù„Ø¯ÙŠÙ†ØŒ Ø¬ÙˆÙ„Ø© Ø³ÙŠØ± ÙÙŠ Ø§Ù„Ø­ÙŠ Ø§Ù„Ù‚Ø¨Ø·ÙŠØŒ ÙˆØ³ÙˆÙ‚ Ø®Ø§Ù† Ø§Ù„Ø®Ù„ÙŠÙ„ÙŠ. Ø§Ù„ØºØ¯Ø§Ø¡ Ø¨Ù…Ø·Ø¹Ù… Ù…Ø­Ù„ÙŠØŒ Ø«Ù… Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„ÙÙ†Ø¯Ù‚.',
            en: 'Grand Egyptian Museum (GEM), Alabaster Mosque, Khan El Khalili Market. Breakfast at hotel and departure to visit Grand Egyptian Museum, Alabaster Mosque, Citadel of Saladin, walking tour in Coptic Quarter and Khan El Khalili market. Lunch at local restaurant.',
            es: 'Gran Museo Egipcio (GEM), Mezquita de Alabastro, Mercado Khan El Khalili.',
            it: 'Grand Egyptian Museum (GEM), Moschea di Alabastro, Mercato Khan El Khalili.',
          },
          sortOrder: 2,
        },
        {
          dayLabel: 'Day 4',
          descriptionJsonb: {
            pt: 'Cairo / Aeroporto. CafÃ© da manhÃ£ no hotel e saÃ­da ao Aeroporto para voo internacional de retorno ao seu paÃ­s de origem. Fim de nossos serviÃ§os.',
            ar: 'Ø§Ù„Ù‚Ø§Ù‡Ø±Ø© / Ø§Ù„Ù…Ø·Ø§Ø±. Ø§Ù„Ø¥ÙØ·Ø§Ø± Ø¨Ø§Ù„ÙÙ†Ø¯Ù‚ Ø«Ù… Ø§Ù„Ø®Ø±ÙˆØ¬ Ù„Ù„Ù…Ø·Ø§Ø± Ù„Ø§Ø³ØªÙ‚Ù„Ø§Ù„ Ø±Ø­Ù„Ø© Ø§Ù„Ø·ÙŠØ±Ø§Ù† Ø§Ù„Ø¯ÙˆÙ„ÙŠØ© Ù„Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„ÙˆØ·Ù†. Ù†Ù‡Ø§ÙŠØ© Ø®Ø¯Ù…Ø§ØªÙ†Ø§.',
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
        es: 'PasiÃ³n de TurquÃ­a',
        ar: 'Ø¹Ø´Ù‚ ØªØ±ÙƒÙŠØ§',
        pt: 'PaixÃ£o da Turquia',
        it: 'Passione della Turchia',
      },
      category: 'turkey',
      basePriceUsd: 1200,
      durationJsonb: {
        en: '10 Days / 9 Nights',
        es: '10 DÃ­as / 9 Noches',
        ar: '10 Ø£ÙŠØ§Ù… / 9 Ù„ÙŠØ§Ù„ÙŠ',
      },
      overviewJsonb: {
        en: 'Discover the magic of Turkey â€” from the minarets of Istanbul to the otherworldly landscapes of Cappadocia.',
        es: 'Descubre la magia de TurquÃ­a.',
        ar: 'Ø§ÙƒØªØ´Ù Ø³Ø­Ø± ØªØ±ÙƒÙŠØ§ Ù…Ù† Ù…Ø¢Ø°Ù† Ø¥Ø³Ø·Ù†Ø¨ÙˆÙ„ Ø¥Ù„Ù‰ ØªØ¶Ø§Ø±ÙŠØ³ ÙƒØ§Ø¨Ø§Ø¯ÙˆÙƒÙŠØ§.',
      },
      itineraries: [
        {
          dayLabel: 'Day 1',
          descriptionJsonb: {
            en: 'Arrival in Istanbul. Transfer to hotel. Welcome dinner.',
            ar: 'Ø§Ù„ÙˆØµÙˆÙ„ Ø¥Ù„Ù‰ Ø¥Ø³Ø·Ù†Ø¨ÙˆÙ„. Ù†Ù‚Ù„ Ø¥Ù„Ù‰ Ø§Ù„ÙÙ†Ø¯Ù‚. Ø¹Ø´Ø§Ø¡ ØªØ±Ø­ÙŠØ¨ÙŠ.',
          },
          sortOrder: 0,
        },
        {
          dayLabel: 'Day 2',
          descriptionJsonb: {
            en: 'Full day tour of the Hagia Sophia, Blue Mosque, and Grand Bazaar.',
            ar: 'Ø¬ÙˆÙ„Ø© ÙƒØ§Ù…Ù„Ø© ÙÙŠ Ø¢ÙŠØ§ ØµÙˆÙÙŠØ§ ÙˆØ§Ù„Ù…Ø³Ø¬Ø¯ Ø§Ù„Ø£Ø²Ø±Ù‚ ÙˆØ§Ù„Ø¨Ø§Ø²Ø§Ø± Ø§Ù„ÙƒØ¨ÙŠØ±.',
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
        ar: 'Ø¹Ø¬Ø§Ø¦Ø¨ Ù…ØµØ±',
        pt: 'Maravilhas do Egito',
        it: "Meraviglie dell'Egitto",
      },
      category: 'egypt',
      basePriceUsd: 950,
      durationJsonb: {
        en: '8 Days / 7 Nights',
        es: '8 DÃ­as / 7 Noches',
        ar: '8 Ø£ÙŠØ§Ù… / 7 Ù„ÙŠØ§Ù„ÙŠ',
      },
      overviewJsonb: {
        en: 'Walk in the footsteps of pharaohs. Explore the Great Pyramids, cruise the Nile, and uncover ancient temples.',
        es: 'Camina en los pasos de los faraones.',
        ar: 'Ø§ØªØ¨Ø¹ Ø®Ø·Ù‰ Ø§Ù„ÙØ±Ø§Ø¹Ù†Ø©. Ø§Ø³ØªÙƒØ´Ù Ø§Ù„Ø£Ù‡Ø±Ø§Ù…Ø§Øª Ø§Ù„Ø¹Ø¸ÙŠÙ…Ø© ÙˆØ§Ø¨Ø­Ø± ÙÙŠ Ø§Ù„Ù†ÙŠÙ„.',
      },
      itineraries: [
        {
          dayLabel: 'Day 1',
          descriptionJsonb: {
            en: 'Arrival in Cairo. Transfer to hotel. Orientation tour.',
            ar: 'Ø§Ù„ÙˆØµÙˆÙ„ Ø¥Ù„Ù‰ Ø§Ù„Ù‚Ø§Ù‡Ø±Ø©. Ù†Ù‚Ù„ Ø¥Ù„Ù‰ Ø§Ù„ÙÙ†Ø¯Ù‚. Ø¬ÙˆÙ„Ø© ØªØ¹Ø±ÙŠÙÙŠØ©.',
          },
          sortOrder: 0,
        },
        {
          dayLabel: 'Day 2',
          descriptionJsonb: {
            en: 'Visit the Great Pyramids of Giza and the Sphinx.',
            ar: 'Ø²ÙŠØ§Ø±Ø© Ø£Ù‡Ø±Ø§Ù…Ø§Øª Ø§Ù„Ø¬ÙŠØ²Ø© Ø§Ù„Ø¹Ø¸ÙŠÙ…Ø© ÙˆØ£Ø¨Ùˆ Ø§Ù„Ù‡ÙˆÙ„.',
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
        ar: 'Ø¬ÙˆØ§Ù‡Ø± Ø§Ù„Ø£Ø±Ø¯Ù†',
        pt: 'JÃ³ias da JordÃ¢nia',
        it: 'Gioielli della Giordania',
      },
      category: 'jordan',
      basePriceUsd: 1100,
      durationJsonb: {
        en: '7 Days / 6 Nights',
        ar: '7 Ø£ÙŠØ§Ù… / 6 Ù„ÙŠØ§Ù„ÙŠ',
      },
      overviewJsonb: {
        en: 'From the rose-red city of Petra to the vast silence of Wadi Rum â€” Jordan is a land of timeless wonder.',
        ar: 'Ù…Ù† Ù…Ø¯ÙŠÙ†Ø© Ø§Ù„Ø¨ØªØ±Ø§Ø¡ Ø§Ù„ÙˆØ±Ø¯ÙŠØ© Ø¥Ù„Ù‰ ØµØ­Ø±Ø§Ø¡ ÙˆØ§Ø¯ÙŠ Ø±Ù… Ø§Ù„Ø´Ø§Ø³Ø¹Ø©.',
      },
      itineraries: [
        {
          dayLabel: 'Day 1',
          descriptionJsonb: {
            en: 'Arrival in Amman. Transfer to hotel.',
            ar: 'Ø§Ù„ÙˆØµÙˆÙ„ Ø¥Ù„Ù‰ Ø¹Ù…Ù‘Ø§Ù†. Ù†Ù‚Ù„ Ø¥Ù„Ù‰ Ø§Ù„ÙÙ†Ø¯Ù‚.',
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
      console.log(`  â†©  Already exists: ${t.slug}`);
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

    console.log(`  âœ… Fallback seeded: ${t.slug}`);
  }
}

async function seedContactSubmissions(): Promise<void> {
  console.log('\nðŸ“Œ Seeding contact submissions...');
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
      subject: 'InformaciÃ³n sobre tours',
      message: 'Me gustarÃ­a recibir informaciÃ³n sobre los tours en espaÃ±ol.',
      locale: 'es',
    },
  ];

  for (const sub of submissions) {
    const existing = await prisma.contactSubmission.findUnique({
      where: { referenceCode: sub.referenceCode },
    });

    if (existing) {
      console.log(`  â†©  Already exists: ${sub.referenceCode}`);
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
      console.log(`  âœ… Seeded contact submission: ${sub.referenceCode}`);
    } catch (err) {
      console.error(
        `  âŒ Failed to seed contact submission: ${sub.referenceCode}`,
        err,
      );
    }
  }
}

async function seedSuperAdmin(): Promise<void> {
  console.log('\nðŸ“Œ Seeding super admin...');
  const email = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log(
      '  â†©  Super admin bootstrap skipped (one-time credentials are not configured).',
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
    console.log('  â†©  Super admin already exists; seed will not modify it.');
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
  console.log('  âœ… One-time super admin bootstrap completed.');
}

async function seedCmsBlocks(): Promise<void> {
  console.log('\nðŸ“Œ Seeding default CMS blocks...');
  const blocks = [
    { key: 'homepage-hero', content: { en: 'Welcome to Dunas Travel' } },
    { key: 'footer-info', content: { en: 'Â© 2026 Dunas Travel' } },
    {
      key: 'hotels_catalog',
      content: [
        {
          id: 'prog-hot-1',
          slug: 'sol-pyramid-hotel',
          name: 'Sol Pyramid Hotel',
          destination: 'egypt',
          city: 'Giza',
          stars: 3,
          rating: 5.0,
          pricePerNight: 85,
          image: 'https://www.solpyramid-egypt.com/wp-content/uploads/2022/08/Hotel.jpg',
          description: 'Solpyramid Hotel is a modern 3-star establishment designed for travellers who want to explore Egypt\'s major sights.',
          amenities: ['Free Wi-Fi', 'Air conditioning', 'Private bathroom', 'Mini bar', 'Coffee & tea', 'Free safe box']
        },
        {
          id: 'htl-eg-01',
          name: 'Four Seasons Hotel Cairo at Nile Plaza',
          destination: 'egypt',
          city: 'Cairo',
          stars: 5,
          rating: 4.9,
          pricePerNight: 350,
          image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
          description: 'Ø¥Ø·Ù„Ø§Ù„Ø© Ø¨Ø§Ù†ÙˆØ±Ø§Ù…ÙŠØ© Ø³Ø§Ø­Ø±Ø© Ø¹Ù„Ù‰ Ù†Ù‡Ø± Ø§Ù„Ù†ÙŠÙ„ ÙˆÙ‚Ù„Ø¨ Ø§Ù„Ù‚Ø§Ù‡Ø±Ø© Ø§Ù„ØªØ§Ø±ÙŠØ®ÙŠØ© Ù…Ø¹ Ø®Ø¯Ù…Ø§Øª ÙƒÙˆÙ†Ø³ÙŠØ±Ø¬ ÙØ§Ø®Ø±Ø© Ø¹Ù„Ù‰ Ù…Ø¯Ø§Ø± Ø§Ù„Ø³Ø§Ø¹Ø©.',
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
          description: 'Ù‚ØµØ± ØªØ§Ø±ÙŠØ®ÙŠ ÙØ®Ù… Ø¹Ù„Ù‰ Ø¶ÙØ§Ù Ø§Ù„Ù†ÙŠÙ„ Ø¨Ø£Ø³ÙˆØ§Ù† Ø§Ø³ØªØ¶Ø§Ù Ø£Ø´Ù‡Ø± Ù…Ù„ÙˆÙƒ Ø§Ù„Ø¹Ø§Ù„Ù… ÙˆØ£Ø¬Ø§Ø«Ø§ ÙƒØ±ÙŠØ³ØªÙŠ.',
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
          description: 'Ø§Ù„Ù‚ØµØ± Ø§Ù„Ø¹Ø«Ù…Ø§Ù†ÙŠ Ø§Ù„ÙˆØ­ÙŠØ¯ Ø¹Ù„Ù‰ Ù…Ø¶ÙŠÙ‚ Ø§Ù„Ø¨ÙˆØ³ÙÙˆØ± Ø§Ù„Ø°ÙŠ ÙŠÙ‚Ø¯Ù… ØªØ¬Ø±Ø¨Ø© Ø¥Ù‚Ø§Ù…Ø© Ù…Ù„ÙƒÙŠØ© Ø§Ø³ØªØ«Ù†Ø§Ø¦ÙŠØ©.',
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
          description: 'Ù…Ù„Ø§Ø° Ø§Ø³ØªØ±Ø®Ø§Ø¡ ÙØ§Ø®Ø± Ø¹Ù„Ù‰ Ø´Ø§Ø·Ø¦ Ø§Ù„Ø¨Ø­Ø± Ø§Ù„Ù…ÙŠØª Ù…Ø­Ø§Ø· Ø¨Ø­Ø¯Ø§Ø¦Ù‚ Ù…Ø¹Ù„Ù‚Ø© ÙˆØ¨Ø­ÙŠØ±Ø§Øª Ø³Ø¨Ø§Ø­Ø© Ø®Ø§ØµØ©.',
          amenities: ['Private Beach', 'Dead Sea Mud Spa', '9 Pools', 'Fine Dining']
        }
      ]
    },
    {
      key: 'holiday_packages',
      content: [
        {
          id: 'pkg-egypt-classic',
          title: 'Ø¨Ø±Ù†Ø§Ù…Ø¬ Ù…ØµØ± Ø§Ù„ÙƒÙ„Ø§Ø³ÙŠÙƒÙŠ Ø§Ù„Ø´Ø§Ù…Ù„ (Ø§Ù„Ù‚Ø§Ù‡Ø±Ø© ÙˆØ§Ù„Ù†ÙŠÙ„)',
          slug: 'egypt-classic-package',
          destination: 'Multi-City Egypt',
          duration: '8 Ø£ÙŠØ§Ù… / 7 Ù„ÙŠØ§Ù„ÙŠ',
          price: 1850,
          type: 'Classic Holiday',
          popular: true,
          description: 'Ø±Ø­Ù„Ø© ÙƒÙ„Ø§Ø³ÙŠÙƒÙŠØ© ÙØ§Ø®Ø±Ø© ØªØ´Ù…Ù„ Ø£Ù‡Ø±Ø§Ù…Ø§Øª Ø§Ù„Ø¬ÙŠØ²Ø©ØŒ Ø§Ù„Ù…ØªØ­Ù Ø§Ù„ÙƒØ¨ÙŠØ±ØŒ ÙˆØ¥Ù‚Ø§Ù…Ø© ÙƒØ±ÙˆØ² 5 Ù†Ø¬ÙˆÙ… Ø¨ÙŠÙ† Ø§Ù„Ø£Ù‚ØµØ± ÙˆØ£Ø³ÙˆØ§Ù†.',
          image: 'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?auto=format&fit=crop&w=800&q=80'
        },
        {
          id: 'pkg-egypt-dubai',
          title: 'Ø¨Ø§ÙƒØ¯Ø¬ Ù…ØµØ± ÙˆØ¯Ø¨ÙŠ Ø§Ù„ÙØ§Ø®Ø± (Multi-Country)',
          slug: 'egypt-dubai-combo',
          destination: 'Multi-Country',
          duration: '10 Ø£ÙŠØ§Ù… / 9 Ù„ÙŠØ§Ù„ÙŠ',
          price: 2450,
          type: 'Luxury Combo',
          popular: true,
          description: 'Ø£ÙØ¶Ù„ Ø¯Ù…Ø¬ Ø¨ÙŠÙ† Ø³Ø­Ø± Ø§Ù„Ø­Ø¶Ø§Ø±Ø© Ø§Ù„ÙØ±Ø¹ÙˆÙ†ÙŠØ© ÙˆÙØ®Ø§Ù…Ø© Ø£Ø¨Ø±Ø§Ø¬ ÙˆØªØ³ÙˆÙ‚ Ø¯Ø¨ÙŠ Ù…Ø¹ Ø¥Ù‚Ø§Ù…Ø© ÙÙŠ ÙÙ†Ø§Ø¯Ù‚ 5 Ù†Ø¬ÙˆÙ….',
          image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80'
        },
        {
          id: 'pkg-honeymoon-redsea',
          title: 'Ø¨Ø§ÙƒØ¯Ø¬ Ø´Ù‡Ø± Ø§Ù„Ø¹Ø³Ù„ (Ø§Ù„Ù‚Ø§Ù‡Ø±Ø© ÙˆØ§Ù„Ø¬ÙˆÙ†Ø©)',
          slug: 'honeymoon-red-sea',
          destination: 'Egypt Resorts',
          duration: '7 Ø£ÙŠØ§Ù… / 6 Ù„ÙŠØ§Ù„ÙŠ',
          price: 1650,
          type: 'Honeymoon',
          popular: false,
          description: 'Ø¹Ø·Ù„Ø© Ø±ÙˆÙ…Ø§Ù†Ø³ÙŠØ© Ù‡Ø§Ø¯Ø¦Ø© ØªØ´Ù…Ù„ Ù…Ù†ØªØ¬Ø¹Ø§Øª Ø§Ù„Ø¬ÙˆÙ†Ø© Ø§Ù„ÙØ§Ø®Ø±Ø©ØŒ ÙŠØ®Øª Ø®Ø§Øµ ÙÙŠ Ø§Ù„Ø¨Ø­Ø± Ø§Ù„Ø£Ø­Ù…Ø±ØŒ ÙˆØ¹Ø´Ø§Ø¡ ÙØ§Ø®Ø± Ø¹Ù„Ù‰ Ø¶ÙØ§Ù Ø§Ù„Ù†ÙŠÙ„.',
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
          features: ['ØªÙƒÙŠÙŠÙ Ù‡ÙˆØ§Ø¦ÙŠ ÙƒØ§Ù…Ù„', 'ÙˆØ§ÙŠ ÙØ§ÙŠ 5G Ù…Ø¬Ø§Ù†ÙŠ', 'Ù…Ù‚Ø§Ø¹Ø¯ Ø¬Ù„Ø¯ÙŠØ© Ù…Ø±ÙŠØ­Ø©', 'Ø´Ø§Ø´Ø§Øª Ø¹Ø±Ø¶ ØªØ±ÙÙŠÙ‡ÙŠØ©', 'Ø«Ù„Ø§Ø¬Ø© ÙˆÙ…Ø´Ø±ÙˆØ¨Ø§Øª', 'Ø³Ø§Ø¦Ù‚ Ù…Ø­ØªØ±Ù Ù…ØªØ¹Ø¯Ø¯ Ø§Ù„Ù„ØºØ§Øª']
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
          features: ['Ù…Ù‚Ø§Ø¹Ø¯ VIP Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„Ø¥Ù…Ø§Ù„Ø©', 'Ù…Ù†Ø§ÙØ° Ø´Ø­Ù† USB', 'ÙˆØ§ÙŠ ÙØ§ÙŠ Ù…Ø¬Ø§Ù†ÙŠ', 'Ø¹Ø§Ø²Ù„ ØµÙˆØª Ù…Ù…ØªØ§Ø²', 'Ø¥Ø¶Ø§Ø¡Ø© Ù…Ø­ÙŠØ·ÙŠØ© Ù‡Ø§Ø¯Ø¦Ø©']
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
          features: ['Ø®Ø¯Ù…Ø© VIP Chauffeur', 'Ù…Ù‚Ø§Ø¹Ø¯ Ù…Ø³Ø§Ø¬ ÙˆØªØ¨Ø±ÙŠØ¯', 'Ø´Ø§Ù…Ø¨Ø§Ù†ÙŠØ§ ÙˆØ¶ÙŠØ§ÙØ© ÙØ§Ø®Ø±Ø©', 'Ù†Ø¸Ø§Ù… ØµÙˆØªÙŠ Burmester']
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
          features: ['Ø¯ÙØ¹ Ø±Ø¨Ø§Ø¹ÙŠ Ù„Ù„ØµØ­Ø±Ø§Ø¡ ÙˆØ§Ù„Ø³ÙØ§Ø±ÙŠ', 'Ù‚ÙØµ Ø­Ù…Ø§ÙŠØ© Ù…Ø¹Ø²Ø²', 'Ù†Ø¸Ø§Ù… ØªØ¨Ø±ÙŠØ¯ ØµØ­Ø±Ø§ÙˆÙŠ ÙØ§Ø¦Ù‚', 'Ø¬Ù‡Ø§Ø² Ù…Ù„Ø§Ø­Ø© GPS ÙˆØ§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø£Ù‚Ù…Ø§Ø± Ø§Ù„ØµÙ†Ø§Ø¹ÙŠØ©']
        }
      ]
    }
  ];

  for (const block of blocks) {
    const existing = await prisma.cmsBlock.findUnique({
      where: { key: block.key },
    });

    if (existing) {
      console.log(`  â†©  Already exists: ${block.key}`);
      continue;
    }

    await prisma.cmsBlock.create({
      data: {
        key: block.key,
        content: block.content,
      },
    });
    console.log(`  âœ… Seeded CMS block: ${block.key}`);
  }
}

async function seedMockBookings(): Promise<void> {
  console.log('\nðŸ“Œ Seeding mock bookings, customers, and finance...');
  const tours = await prisma.tour.findMany();
  if (tours.length === 0) {
    console.log('  âš   No tours found to attach bookings to.');
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

    console.log(`  âœ… Seeded booking: ${refCode}`);
  }
}

async function seedTourLandingPages(): Promise<void> {
  console.log('\nðŸ“Œ Seeding Tour Landing Pages (Interfaces)...');

  const landingPagesData = [
    {
      slug: 'egypt',
      type: 'DESTINATION',
      titleJsonb: {
        en: 'Egypt',
        es: 'Egipto',
        ar: 'Ù…ØµØ±',
        pt: 'Egito',
        it: 'Egitto',
      },
      subtitleJsonb: {
        en: 'Land of the Pharaohs',
        es: 'Tierra de los Faraones',
        ar: 'Ø£Ø±Ø¶ Ø§Ù„ÙØ±Ø§Ø¹Ù†Ø©',
        pt: 'Terra dos FaraÃ³s',
        it: 'Terra dei Faraoni',
      },
      descriptionJsonb: {
        en: 'From the timeless Pyramids of Giza to the golden temples of Luxor and the crystal waters of the Red Sea, Egypt offers a journey through history like no other.',
        es: 'Desde las pirÃ¡mides hasta el mar Rojo, descubre la cuna de la civilizaciÃ³n.',
        ar: 'Ù…Ù† Ø£Ù‡Ø±Ø§Ù…Ø§Øª Ø§Ù„Ø¬ÙŠØ²Ø© Ø¥Ù„Ù‰ Ù…Ø¹Ø§Ø¨Ø¯ Ø§Ù„Ø£Ù‚ØµØ± ÙˆØ´ÙˆØ§Ø·Ø¦ Ø§Ù„Ø¨Ø­Ø± Ø§Ù„Ø£Ø­Ù…Ø± Ø§Ù„Ø³Ø§Ø­Ø±Ø©.',
        pt: 'Das pirÃ¢mides ao Rio Nilo, viva uma experiÃªncia inesquecÃ­vel.',
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
        es: 'TurquÃ­a',
        ar: 'ØªØ±ÙƒÙŠØ§',
        pt: 'Turquia',
        it: 'Turchia',
      },
      subtitleJsonb: {
        en: 'Where East Meets West',
        es: 'Donde Oriente se encuentra con Occidente',
        ar: 'Ù…Ù„ØªÙ‚Ù‰ Ø§Ù„Ø´Ø±Ù‚ ÙˆØ§Ù„ØºØ±Ø¨',
        pt: 'Onde o Oriente se Encontra com o Ocidente',
        it: "Dove l'Oriente Incontra l'Occidente",
      },
      descriptionJsonb: {
        en: 'Explore Istanbul, the fairy chimneys of Cappadocia, ancient Ephesus, and travertine pools of Pamukkale.',
        es: 'Descubre Estambul, Capadoccia y los tesoros de TurquÃ­a.',
        ar: 'Ø§Ø³ØªÙƒØ´Ù Ø¥Ø³Ø·Ù†Ø¨ÙˆÙ„ ÙˆÙƒØ§Ø¨Ø§Ø¯ÙˆÙƒÙŠØ§ ÙˆÙ…Ù†Ø§Ø¸Ø± ØªØ±ÙƒÙŠØ§ Ø§Ù„Ø·Ø¨ÙŠØ¹ÙŠØ© Ø§Ù„ØªØ§Ø±ÙŠØ®ÙŠØ©.',
        pt: 'ConheÃ§a Istambul e os balÃµes da CapadÃ³cia.',
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
        ar: 'Ø§Ù„Ø£Ø±Ø¯Ù†',
        pt: 'JordÃ¢nia',
        it: 'Giordania',
      },
      subtitleJsonb: {
        en: 'Kingdom of Wonder',
        es: 'Reino de Maravillas',
        ar: 'Ù…Ù…Ù„ÙƒØ© Ø§Ù„Ø¹Ø¬Ø§Ø¦Ø¨',
        pt: 'Reino das Maravilhas',
        it: 'Regno delle Meraviglie',
      },
      descriptionJsonb: {
        en: 'Walk in the pink-red sandstone canyons of Petra and float on the Dead Sea.',
        es: 'Explora la legendaria ciudad de Petra y el desierto de Wadi Rum.',
        ar: 'Ø²ÙŠØ§Ø±Ø© Ù…Ø¯ÙŠÙ†Ø© Ø§Ù„Ø¨ØªØ±Ø§Ø¡ Ø§Ù„ÙˆØ±Ø¯ÙŠØ© ÙˆÙˆØ§Ø¯ÙŠ Ø±Ù… ÙˆØ§Ù„Ø¨Ø­Ø± Ø§Ù„Ù…ÙŠØª.',
        pt: 'Descubra Petra e o deserto de Wadi Rum.',
        it: 'Visita la magica cittÃ  di Petra.',
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
        ar: 'Ø§Ù„Ù…ØºØ±Ø¨',
        pt: 'Marrocos',
        it: 'Marocco',
      },
      subtitleJsonb: {
        en: 'Land of Colors & Spices',
        es: 'Tierra de Colores y Especias',
        ar: 'Ø£Ø±Ø¶ Ø§Ù„Ø£Ù„ÙˆØ§Ù† ÙˆØ§Ù„ØªÙˆØ§Ø¨Ù„',
        pt: 'Terra de Cores e Especiarias',
        it: 'Terra di Colori e Spezie',
      },
      descriptionJsonb: {
        en: 'Discover Marrakech, Fes, Chefchaouen, and the Sahara desert dunes.',
        es: 'Descubre Marrakech, Fez y las dunas del Sahara.',
        ar: 'Ø±Ø­Ù„Ø§Øª Ø¹Ø¨Ø± Ù…Ø±Ø§ÙƒØ´ ÙˆÙØ§Ø³ ÙˆØ§Ù„ØµØ­Ø±Ø§Ø¡ Ø§Ù„ÙƒØ¨Ø±Ù‰.',
        pt: 'Explore as cidades imperiais de Marrocos.',
        it: 'Scopri le cittÃ  imperiali del Marocco.',
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
        ar: 'Ø§Ù„ÙŠÙˆÙ†Ø§Ù†',
        pt: 'GrÃ©cia',
        it: 'Grecia',
      },
      subtitleJsonb: {
        en: 'Cradle of Civilization',
        es: 'Cuna de la CivilizaciÃ³n',
        ar: 'Ù…Ù‡Ø¯ Ø§Ù„Ø­Ø¶Ø§Ø±Ø©',
        pt: 'BerÃ§o da CivilizaÃ§Ã£o',
        it: 'Culla della CiviltÃ ',
      },
      descriptionJsonb: {
        en: 'Experience Athens Acropolis and breathtaking Aegean islands.',
        es: 'Atenas, Santorini y las islas griegas.',
        ar: 'Ø§Ø³ØªÙƒØ´Ù Ø£Ø«ÙŠÙ†Ø§ ÙˆØ¬Ø²Ø± Ø§Ù„ÙŠÙˆÙ†Ø§Ù† Ø§Ù„Ø³Ø§Ø­Ø±Ø©.',
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
        es: 'DubÃ¡i',
        ar: 'Ø¯Ø¨ÙŠ',
        pt: 'Dubai',
        it: 'Dubai',
      },
      subtitleJsonb: {
        en: 'City of the Future',
        es: 'Ciudad del Futuro',
        ar: 'Ù…Ø¯ÙŠÙ†Ø© Ø§Ù„Ù…Ø³ØªÙ‚Ø¨Ù„',
        pt: 'Cidade do Futuro',
        it: 'CittÃ  del Futuro',
      },
      descriptionJsonb: {
        en: 'Ultra-modern architecture, desert safaris, and luxury shopping.',
        es: 'Lujo, arquitectura moderna y safaris en el desierto.',
        ar: 'Ù†Ø§Ø·Ø­Ø§Øª Ø§Ù„Ø³Ø­Ø§Ø¨ ÙˆØ§Ù„Ø³ÙØ§Ø±ÙŠ ÙˆØ§Ù„ØªØ³ÙˆÙ‚ Ø§Ù„ÙØ§Ø®Ø±.',
        pt: 'O luxo e a modernidade de Dubai.',
        it: 'Lusso e modernitÃ  a Dubai.',
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
        es: 'TÃºnez',
        ar: 'ØªÙˆÙ†Ø³',
        pt: 'TunÃ­sia',
        it: 'Tunisia',
      },
      subtitleJsonb: {
        en: 'Oasis & Mediterranean Charm',
        es: 'Oasis y Encanto MediterrÃ¡neo',
        ar: 'Ø³Ø­Ø± Ø§Ù„ÙˆØ§Ø­Ø§Øª ÙˆØ§Ù„Ù…ØªÙˆØ³Ø·',
        pt: 'OÃ¡sis e Charme MediterrÃ¢neo',
        it: 'Oasi e Fascino Mediterraneo',
      },
      descriptionJsonb: {
        en: 'Carthage ruins, Sidi Bou Said, and Sahara oases.',
        es: 'Cartago, Sidi Bou Said y los oasis de TÃºnez.',
        ar: 'Ø¢Ø«Ø§Ø± Ù‚Ø±Ø·Ø§Ø¬ ÙˆØ³ÙŠØ¯ÙŠ Ø¨ÙˆØ³Ø¹ÙŠØ¯ ÙˆÙˆØ§Ø­Ø§Øª Ø§Ù„ØµØ­Ø±Ø§Ø¡.',
        pt: 'ConheÃ§a as ruÃ­nas de Cartago e Sidi Bou Said.',
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
        es: 'Tours MultipaÃ­s',
        ar: 'Ø±Ø­Ù„Ø§Øª Ù…ØªØ¹Ø¯Ø¯Ø© Ø§Ù„Ø¯ÙˆÙ„',
        pt: 'Tours Multi-PaÃ­ses',
        it: 'Tour Multi-Paese',
      },
      subtitleJsonb: {
        en: 'Grand Middle East Expeditions',
        es: 'Grandes Expediciones por Medio Oriente',
        ar: 'Ø±Ø­Ù„Ø§Øª Ø´Ø§Ù…Ù„Ø© Ø¹Ø¨Ø± Ø§Ù„Ø´Ø±Ù‚ Ø§Ù„Ø£ÙˆØ³Ø·',
        pt: 'Grandes ExpediÃ§Ãµes pelo Oriente MÃ©dio',
        it: 'Grandi Spedizioni in Medio Oriente',
      },
      descriptionJsonb: {
        en: 'Combined travel packages covering Egypt, Jordan, Turkey, Dubai, and Morocco.',
        es: 'Paquetes combinados visitando varios paÃ­ses de Medio Oriente.',
        ar: 'Ø±Ø­Ù„Ø§Øª ØªØ¬Ù…Ø¹ Ø¨ÙŠÙ† Ù…ØµØ± ÙˆØ§Ù„Ø£Ø±Ø¯Ù† ÙˆØªØ±ÙƒÙŠØ§ ÙˆØ§Ù„Ø¥Ù…Ø§Ø±Ø§Øª ÙˆØ§Ù„Ù…ØºØ±Ø¨.',
        pt: 'Pacotes combinando Egito, JordÃ¢nia e Turquia.',
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
        ar: 'Ø±Ø­Ù„Ø§Øª Ø¯ÙŠÙ†ÙŠØ©',
        pt: 'Tours Religiosos',
        it: 'Tour Religiosi',
      },
      subtitleJsonb: {
        en: 'Sacred Footsteps & Pilgrimages',
        es: 'Huellas Sagradas y Peregrinaciones',
        ar: 'Ù…Ø³Ø§Ø±Ø§Øª Ù…Ù‚Ø¯Ø³Ø© ÙˆØ±Ø­Ù„Ø§Øª Ø¥ÙŠÙ…Ø§Ù†ÙŠØ©',
        pt: 'Pegadas Sagradas e PeregrinaÃ§Ãµes',
        it: 'Impronte Sacre e Pellegrinaggi',
      },
      descriptionJsonb: {
        en: 'Holy land pilgrimages and spiritual journeys across sacred historical sites.',
        es: 'Peregrinaciones a Tierra Santa y sitios sagrados.',
        ar: 'Ø±Ø­Ù„Ø§Øª Ø¥ÙŠÙ…Ø§Ù†ÙŠØ© ÙˆØ²ÙŠØ§Ø±Ø© Ø§Ù„Ù…Ø¹Ø§Ù„Ù… Ø§Ù„Ù…Ù‚Ø¯Ø³Ø©.',
        pt: 'PeregrinaÃ§Ãµes pela Terra Santa.',
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
      console.log(`  â†©  Landing Page exists: ${page.slug}`);
      landingPageId = existing.id;
    } else {
      const created = await prisma.tourLandingPage.create({ data: page });
      console.log(`  âœ… Seeded Landing Page: ${page.slug}`);
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
        `     â”” Attached ${matchingTours.length} tours to '${page.slug}'`,
      );
    }
  }
}

// â”€â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function main(): Promise<void> {
  console.log('\nðŸŒ± Starting Dunas Travel database seed...\n');
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
      console.log(`ðŸ“‚ Found programs.json at: ${jsonPath}`);
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
          console.log(`ðŸ“¦ Found ${programs.length} programs to seed\n`);
          break;
        }
      } catch (error) {
        console.warn(`  âš   Failed to parse: ${jsonPath}`, error);
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
    console.warn('âš   programs.json not found or empty.');
    console.log('ðŸ“Œ Using fallback sample data instead.\n');
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

  console.log('\nâœ… Seed complete!\n');
}

main()
  .catch((error: unknown) => {
    console.error('âŒ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

