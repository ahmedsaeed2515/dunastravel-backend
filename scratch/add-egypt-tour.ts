import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_7ySL8IBrJYwN@ep-cool-sea-atufhdxz-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  console.log('Connecting to database...');
  const existing = await prisma.tour.findUnique({
    where: { slug: 'cairo-express-4d' },
  });

  if (existing) {
    console.log('Tour cairo-express-4d already exists in DB! Updating attributes...');
    const updated = await prisma.tour.update({
      where: { slug: 'cairo-express-4d' },
      data: {
        country: 'Egypt',
        category: 'egypt',
        city: 'Cairo',
        status: 'PUBLISHED',
        isActive: true,
        deletedAt: null,
      },
    });
    console.log(`✅ Updated existing tour ID: ${updated.id} | Slug: ${updated.slug}`);
  } else {
    console.log('Creating cairo-express-4d tour in DB...');
    const created = await prisma.tour.create({
      data: {
        slug: 'cairo-express-4d',
        titleJsonb: {
          ar: 'القاهرة اكسبرس',
          en: 'Cairo Express',
          pt: 'Cairo Express',
          es: 'Cairo Express',
          it: 'Cairo Express',
        },
        category: 'egypt',
        country: 'Egypt',
        city: 'Cairo',
        basePriceUsd: 450,
        status: 'PUBLISHED',
        isActive: true,
        durationJsonb: {
          ar: '4 أيام / 3 ليالٍ',
          en: '4 Days / 3 Nights',
          pt: '4 Dias / 3 Noites',
          es: '4 Días / 3 Noches',
          it: '4 Giorni / 3 Notti',
        },
        overviewJsonb: {
          ar: 'برنامج مكثف لمدة أربعة أيام لاستكشاف قلب مصر القديمة. زيارة أهرامات الجيزة، أبو الهول، ممفيس، سقارة، المتحف المصري الكبير، مسجد الألباستر، وسوق خان الخليلي النابض بالحياة. باقة كاملة تشمل التوصيلات، الإقامة، والتأشيرة.',
          en: 'An intense 4-day itinerary exploring the heart of Ancient Egypt. Visit the Pyramids of Giza, the Sphinx, Memphis, Saqqara, the Grand Egyptian Museum, the Alabaster Mosque, and Khan El Khalili market.',
          pt: 'Roteiro intenso de quatro dias explorando o coração do Egito Antigo.',
        },
        includedServicesJsonb: {
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
      },
    });
    console.log(`✅ Created tour ID: ${created.id} | Slug: ${created.slug}`);

    // Create itinerary days
    await prisma.tourItinerary.createMany({
      data: [
        {
          tourId: created.id,
          dayLabel: 'Day 1',
          descriptionJsonb: {
            ar: 'الوصول إلى مطار القاهرة الدولي والنقل إلى الفندق. حسب وقت الوصول، يمكن تقديم بعض الجولات الاختيارية.',
            en: 'Arrival at Cairo International Airport and transfer to hotel.',
          },
          mealsJsonb: { ar: 'بدون وجبات', en: 'No meals' },
          sortOrder: 0,
        },
        {
          tourId: created.id,
          dayLabel: 'Day 2',
          descriptionJsonb: {
            ar: 'الأهرامات، أبو الهول، مصنع البردي، ممفيس وسقارة.',
            en: 'Pyramids, Sphinx, Papyrus Factory, Memphis & Saqqara.',
          },
          mealsJsonb: { ar: 'إفطار وغداء', en: 'Breakfast & Lunch' },
          sortOrder: 1,
        },
        {
          tourId: created.id,
          dayLabel: 'Day 3',
          descriptionJsonb: {
            ar: 'المتحف المصري الكبير (GEM)، مسجد الألباستر، وسوق خان الخليلي.',
            en: 'Grand Egyptian Museum (GEM), Alabaster Mosque, Khan El Khalili Market.',
          },
          mealsJsonb: { ar: 'إفطار وغداء', en: 'Breakfast & Lunch' },
          sortOrder: 2,
        },
        {
          tourId: created.id,
          dayLabel: 'Day 4',
          descriptionJsonb: {
            ar: 'القاهرة / المطار. التوصيل للمطار للمغادرة.',
            en: 'Cairo / Airport departure.',
          },
          mealsJsonb: { ar: 'إفطار', en: 'Breakfast' },
          sortOrder: 3,
        },
      ],
    });

    // Hero Image
    await prisma.tourImage.create({
      data: {
        tourId: created.id,
        imageUrl:
          'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?q=80&w=1200',
        isHero: true,
        sortOrder: 0,
      },
    });
    console.log('✅ Itineraries and hero image created!');
  }
}

run()
  .catch((err) => {
    console.error('❌ Error:', err);
  })
  .finally(async () => {
    await pool.end();
  });
