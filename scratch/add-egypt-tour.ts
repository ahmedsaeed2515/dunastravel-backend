import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_7ySL8IBrJYwN@ep-cool-sea-atufhdxz-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const tours = [
  {
    slug: 'cairo-express-4d',
    titleJsonb: { ar: 'القاهرة اكسبرس', en: 'Cairo Express', pt: 'Cairo Express', es: 'Cairo Express', it: 'Cairo Express' },
    category: 'egypt',
    country: 'Egypt',
    city: 'Cairo',
    basePriceUsd: 450,
    status: 'PUBLISHED',
    isActive: true,
    durationJsonb: { ar: '4 أيام / 3 ليالٍ', en: '4 Days / 3 Nights', pt: '4 Dias / 3 Noites' },
    overviewJsonb: {
      ar: 'برنامج مكثف لمدة أربعة أيام لاستكشاف قلب مصر القديمة. زيارة أهرامات الجيزة، أبو الهول، ممفيس، سقارة، المتحف المصري الكبير، مسجد الألباستر، وسوق خان الخليلي النابض بالحياة.',
      en: 'An intense 4-day itinerary exploring the heart of Ancient Egypt. Visit the Pyramids of Giza, the Sphinx, Memphis, Saqqara, the Grand Egyptian Museum, the Alabaster Mosque, and Khan El Khalili market.',
    },
    images: ['https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?q=80&w=1200'],
  },
  {
    slug: 'cairo-express-alexandria-5d',
    titleJsonb: { ar: 'القاهرة اكسبرس مع الإسكندرية', en: 'Cairo Express with Alexandria', pt: 'Cairo Express com Alexandria', es: 'El Cairo Express con Alejandría', it: 'Cairo Express con Alessandria' },
    category: 'egypt',
    country: 'Egypt',
    city: 'Cairo & Alexandria',
    basePriceUsd: 550,
    status: 'PUBLISHED',
    isActive: true,
    durationJsonb: { ar: '5 أيام / 4 ليالٍ', en: '5 Days / 4 Nights', pt: '5 Dias / 4 Noites' },
    overviewJsonb: {
      ar: 'جولة رائعة لمدة 5 أيام تغطي أهرامات الجيزة والمعالم التاريخية بالقاهرة، بالإضافة إلى جولة خاصة لعروس البحر المتوسط الإسكندرية وشاطئها ومكتبتها العريقة.',
      en: 'A 5-day tour covering Cairo pyramids and historic landmarks, plus a full day trip to Alexandria on the Mediterranean.',
    },
    images: ['https://images.unsplash.com/photo-1572252821143-035a0f6700c2?q=80&w=1200'],
  },
  {
    slug: 'egito-classico-8d',
    titleJsonb: { ar: 'مصر الكلاسيكية', en: 'Classic Egypt', pt: 'Egito Clássico', es: 'Egipto Clásico', it: 'Egitto Classico' },
    category: 'egypt',
    country: 'Egypt',
    city: 'Cairo, Luxor & Aswan',
    basePriceUsd: 1150,
    status: 'PUBLISHED',
    isActive: true,
    durationJsonb: { ar: '8 أيام / 7 ليالٍ', en: '8 Days / 7 Nights', pt: '8 Dias / 7 Noites' },
    overviewJsonb: {
      ar: 'برنامج مصر الكلاسيكي الشامل لمدة 8 أيام: 3 ليالٍ في القاهرة مع زيارة الأهرامات، وإبحار كروز فاخر على النيل بين الأقصر وأسوان لمدة 4 ليالٍ مع زيارة معابد الكرنك والشرق والغرب.',
      en: 'Comprehensive 8-day Classic Egypt program: 3 nights Cairo with pyramids, and 4 nights luxury Nile Cruise between Luxor & Aswan.',
    },
    images: ['https://images.unsplash.com/photo-1539650116574-75c0c6d73c0e?q=80&w=1200'],
  },
  {
    slug: 'egito-classico-ii-9d',
    titleJsonb: { ar: 'مصر الكلاسيكية 2 مع الإسكندرية', en: 'Classic Egypt II with Alexandria', pt: 'Egito Clássico II', es: 'Egipto Clásico II con Alejandría', it: 'Egitto Classico II con Alessandria' },
    category: 'egypt',
    country: 'Egypt',
    city: 'Cairo, Nile Cruise & Alexandria',
    basePriceUsd: 1290,
    status: 'PUBLISHED',
    isActive: true,
    durationJsonb: { ar: '9 أيام / 8 ليالٍ', en: '9 Days / 8 Nights', pt: '9 Dias / 8 Noites' },
    overviewJsonb: {
      ar: 'رحلة متكاملة لمدة 9 أيام تجمع بين سحر القاهرة التاريخية، إبحار النيل بين أسوان والأقصر، ورحلة خاصة إلى مدينة الإسكندرية البحرية.',
      en: 'Complete 9-day journey combining Cairo history, Nile sailing between Aswan & Luxor, and Alexandria Mediterranean tour.',
    },
    images: ['https://images.unsplash.com/photo-1568322445389-f64ac2515020?q=80&w=1200'],
  },
  {
    slug: 'egito-historico-10d',
    titleJsonb: { ar: 'مصر التاريخية وأبو سمبل', en: 'Historic Egypt & Abu Simbel', pt: 'Egito Histórico', es: 'Egipto Histórico y Abu Simbel', it: 'Egitto Storico e Abu Simbel' },
    category: 'egypt',
    country: 'Egypt',
    city: 'Cairo, Luxor, Aswan & Abu Simbel',
    basePriceUsd: 1450,
    status: 'PUBLISHED',
    isActive: true,
    durationJsonb: { ar: '10 أيام / 9 ليالٍ', en: '10 Days / 9 Nights', pt: '10 Dias / 9 Noites' },
    overviewJsonb: {
      ar: 'رحلة تاريخية متعمقة لمدة 10 أيام تشمل القاهرة والأهرامات، الإبحار في النيل، بالإضافة إلى جولة معبد أبو سمبل العظيم لرمسيس الثاني.',
      en: 'In-depth 10-day historical tour including Cairo Pyramids, Nile sailing, and the grand Ramses II Abu Simbel temples.',
    },
    images: ['https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?q=80&w=1200'],
  },
  {
    slug: 'grande-ramses-10d',
    titleJsonb: { ar: 'برنامج رمسيس الكبير', en: 'The Great Ramses Program', pt: 'O Grande Ramses', es: 'El Gran Ramsés', it: 'Il Grande Ramses' },
    category: 'egypt',
    country: 'Egypt',
    city: 'Cairo, Luxor, Aswan & Alexandria',
    basePriceUsd: 1550,
    status: 'PUBLISHED',
    isActive: true,
    durationJsonb: { ar: '10 أيام / 9 ليالٍ', en: '10 Days / 9 Nights', pt: '10 Dias / 9 Noites' },
    overviewJsonb: {
      ar: 'الباقة الملكية الفاخرة رمسيس الكبير: إقامة 5 نجوم ديلاكس، كروز النيل، زيارة القاهرة والأهرامات والمتحف الجديد والإسكندرية والأقصر وأسوان.',
      en: 'The Royal Great Ramses package: Deluxe 5-star stay, Nile Cruise, Cairo Pyramids, GEM, Alexandria, Luxor & Aswan.',
    },
    images: ['https://images.unsplash.com/photo-1572252821143-035a0f6700c2?q=80&w=1200'],
  },
  {
    slug: 'tesouros-egipto-9d',
    titleJsonb: { ar: 'كنوز مصر والإسكندرية', en: 'Treasures of Egypt & Alexandria', pt: 'Tesouros do Egito com Alexandria', es: 'Tesoros de Egipto con Alejandría', it: "Tesori d'Egitto con Alessandria" },
    category: 'egypt',
    country: 'Egypt',
    city: 'Cairo, Nile Cruise & Alexandria',
    basePriceUsd: 1350,
    status: 'PUBLISHED',
    isActive: true,
    durationJsonb: { ar: '9 أيام / 8 ليالٍ', en: '9 Days / 8 Nights', pt: '9 Dias / 8 Noites' },
    overviewJsonb: {
      ar: 'استكشف كنوز الحضارة المصرية في 9 أيام: القاهرة، أهرامات الجيزة، المتحف المصري الكبير، إبحار النيل بين الأقصر وأسوان، وجولة ساحلية بالإسكندرية.',
      en: 'Discover Egyptian treasures in 9 days: Cairo, Giza Pyramids, GEM, Nile Cruise between Luxor & Aswan, and Alexandria.',
    },
    images: ['https://images.unsplash.com/photo-1539650116574-75c0c6d73c0e?q=80&w=1200'],
  },
  {
    slug: 'cairo-cruzeiro-sharm-11d',
    titleJsonb: { ar: 'القاهرة وكروز النيل وشرم الشيخ', en: 'Cairo, Nile Cruise & Sharm El Sheikh', pt: 'Cairo c/ Cruzeiro + Sharm El Sheikh', es: 'El Cairo, Crucero Nilo y Sharm El Sheikh', it: 'Cairo, Crociera Nilo e Sharm El Sheikh' },
    category: 'egypt',
    country: 'Egypt',
    city: 'Cairo, Nile Cruise & Sharm El Sheikh',
    basePriceUsd: 1690,
    status: 'PUBLISHED',
    isActive: true,
    durationJsonb: { ar: '11 يوماً / 10 ليالٍ', en: '11 Days / 10 Nights', pt: '11 Dias / 10 Noites' },
    overviewJsonb: {
      ar: 'الباقة المتكاملة الأكثر استرخاءً 11 يوماً: استكشاف القاهرة والأهرامات، إبحار كروز النيل بين الأقصر وأسوان، والاستجمام في منتجعات شرم الشيخ والشعب المرجانية.',
      en: 'The ultimate 11-day relaxing program: Cairo Pyramids, Nile Cruise sailing, and Red Sea Sharm El Sheikh beach resort stay.',
    },
    images: ['https://images.unsplash.com/photo-1568322445389-f64ac2515020?q=80&w=1200'],
  },
];

async function run() {
  console.log(`Starting to seed/upsert ${tours.length} Egypt tours to Neon DB...`);
  for (const t of tours) {
    const existing = await prisma.tour.findUnique({ where: { slug: t.slug } });
    if (existing) {
      const updated = await prisma.tour.update({
        where: { slug: t.slug },
        data: {
          country: 'Egypt',
          category: 'egypt',
          city: t.city,
          status: 'PUBLISHED',
          isActive: true,
          deletedAt: null,
          titleJsonb: t.titleJsonb,
          basePriceUsd: t.basePriceUsd,
          durationJsonb: t.durationJsonb,
          overviewJsonb: t.overviewJsonb,
        },
      });
      console.log(`✅ Updated existing tour: ${updated.slug} (${updated.id})`);
    } else {
      const created = await prisma.tour.create({
        data: {
          slug: t.slug,
          titleJsonb: t.titleJsonb,
          category: 'egypt',
          country: 'Egypt',
          city: t.city,
          basePriceUsd: t.basePriceUsd,
          status: 'PUBLISHED',
          isActive: true,
          durationJsonb: t.durationJsonb,
          overviewJsonb: t.overviewJsonb,
        },
      });
      console.log(`✅ Created tour: ${created.slug} (${created.id})`);

      // Hero image
      if (t.images && t.images.length > 0) {
        await prisma.tourImage.create({
          data: {
            tourId: created.id,
            imageUrl: t.images[0],
            isHero: true,
            sortOrder: 0,
          },
        });
      }
    }
  }
  console.log('🎉 All 8 Egypt tours successfully seeded into Neon DB!');
}

run()
  .catch((err) => {
    console.error('❌ Error executing seed:', err);
  })
  .finally(async () => {
    await pool.end();
  });
