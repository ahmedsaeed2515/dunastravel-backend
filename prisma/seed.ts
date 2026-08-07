import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';
import { seedMediaAssets } from './seeds/media.seed';
import * as bcrypt from 'bcryptjs';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:password@127.0.0.1:5432/dunastravel_db';
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

  if (isProduction && seedDemoData) {
    throw new Error('SEED_DEMO_DATA is forbidden in production.');
  }

  // Attempt to read programs.json from the frontend
  const possiblePaths = [
    path.join(__dirname, '../../frontend/src/data/programs.json'),
    path.join(__dirname, '../frontend/src/data/programs.json'),
    path.join(process.cwd(), '../frontend/src/data/programs.json'),
    path.join(process.cwd(), 'frontend/src/data/programs.json'),
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
    await seedFallbackTours();
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
