import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';
import { seedMediaAssets } from './seeds/media.seed';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@127.0.0.1:5432/dunastravel_db';
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
  const raw =
    program.basePriceUsd ??
    program.price ??
    program.basePrice ??
    999;

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
            (program.overview ??
              program.description) as string | Record<string, string>,
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
              (day.description ??
                day.title) as string | Record<string, string>,
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
        it: 'Meraviglie dell\'Egitto',
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
    }
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
      console.error(`  ❌ Failed to seed contact submission: ${sub.referenceCode}`, err);
    }
  }
}

async function seedSuperAdmin(): Promise<void> {
  console.log('\n📌 Seeding super admin...');
  const existing = await prisma.user.findUnique({
    where: { email: 'admin@dunastravel.com' },
  });

  if (existing) {
    console.log(`  ↩  Already exists: admin@dunastravel.com`);
    return;
  }

  const passwordHash = await bcrypt.hash('Admin@123!', 10);
  await prisma.user.create({
    data: {
      email: 'admin@dunastravel.com',
      name: 'Super Admin',
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log(`  ✅ Seeded super admin: admin@dunastravel.com`);
}

async function seedCmsBlocks(): Promise<void> {
  console.log('\n📌 Seeding default CMS blocks...');
  const blocks = [
    { key: 'homepage-hero', content: { en: 'Welcome to Dunas Travel' } },
    { key: 'footer-info', content: { en: '© 2026 Dunas Travel' } }
  ];

  for (const block of blocks) {
    const existing = await prisma.cmsBlock.findUnique({
      where: { key: block.key }
    });

    if (existing) {
      console.log(`  ↩  Already exists: ${block.key}`);
      continue;
    }

    await prisma.cmsBlock.create({
      data: {
        key: block.key,
        content: block.content,
      }
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
    let customer = await prisma.user.findUnique({ where: { email: `customer${i}@example.com` } });
    if (!customer) {
      customer = await prisma.user.create({
        data: {
          email: `customer${i}@example.com`,
          name: `Customer ${i}`,
          passwordHash: 'dummy',
          role: 'USER',
          status: 'ACTIVE',
          customerNumber: `CUST-100${i}`,
        }
      });
    }
    customers.push(customer);
  }

  // Create wallet for first customer
  let wallet = await prisma.wallet.findUnique({
    where: { ownerType_ownerId: { ownerType: 'USER', ownerId: customers[0].id } }
  });
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: {
        ownerType: 'USER',
        ownerId: customers[0].id,
        balance: 500.00,
        currency: 'USD'
      }
    });
    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: 500.00,
        type: 'CREDIT',
        referenceType: 'MANUAL_ADDITION',
        status: 'COMPLETED'
      }
    });
  }

  // Create some bookings
  for (let i = 1; i <= 10; i++) {
    const refCode = `BKG-2026-${i.toString().padStart(3, '0')}`;
    const existing = await prisma.booking.findUnique({ where: { referenceCode: refCode } });
    if (existing) continue;

    const tour = tours[i % tours.length];
    const customer = customers[i % customers.length];

    const booking = await prisma.booking.create({
      data: {
        referenceCode: refCode,
        userId: customer.id,
        tourId: tour.id,
        status: i % 3 === 0 ? 'CONFIRMED' : 'PENDING',
        arrivalDate: new Date(new Date().getTime() + (i * 86400000 * 5)),
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
            invoiceType: 'PERSONAL'
          }
        },
        passengers: {
          create: [
            { passengerType: 'ADULT', fullName: customer.name },
            { passengerType: 'ADULT', fullName: `Partner of ${customer.name}` }
          ]
        }
      }
    });

    if (Number(booking.paidAmountUsd) > 0) {
      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          amount: booking.paidAmountUsd,
          currency: 'USD',
          method: 'CREDIT_CARD',
          status: 'CAPTURED',
          transactionId: `txn_${Date.now()}`
        }
      });
      await prisma.invoice.create({
        data: {
          bookingId: booking.id,
          invoiceNumber: `INV-${refCode}`
        }
      });
    }

    console.log(`  ✅ Seeded booking: ${refCode}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n🌱 Starting Dunas Travel database seed...\n');

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
    console.warn('⚠  programs.json not found or empty.');
    console.log('📌 Using fallback sample data instead.\n');
    await seedFallbackTours();
  }

  await seedContactSubmissions();

  await seedSuperAdmin();
  await seedCmsBlocks();

  await seedMediaAssets(prisma);
  await seedMockBookings();

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
