const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const dotenv = require('dotenv');

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@127.0.0.1:5432/dunastravel_db';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TOUR_COVER_IMAGES = {
  // Morocco
  'mrc-01-spices-of-morocco': 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?auto=format&fit=crop&w=1200&q=80',
  'spices-of-egypt-and-morocco': 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?auto=format&fit=crop&w=1200&q=80',

  // Turkey
  'reg-01-legendary-turkey': 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1200&q=80',
  'reg-04-legendary-cappadocia': 'https://images.unsplash.com/photo-1609856878074-ce31ec407ac4?auto=format&fit=crop&w=1200&q=80',
  'ist-01-best-of-istanbul': 'https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?auto=format&fit=crop&w=1200&q=80',
  'reg-03-passion-of-turkey': 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1200&q=80',
  'reg-05-admirable-turkey': 'https://images.unsplash.com/photo-1527838832700-5059252407fa?auto=format&fit=crop&w=1200&q=80',
  'reg-06-heart-of-turkey': 'https://images.unsplash.com/photo-1570939274717-7eda259b50ed?auto=format&fit=crop&w=1200&q=80',
  'reg-07-turkish-riviera': 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
  'reg-08-stop-over': 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1200&q=80',
  'reg-09-turkey-without-rush': 'https://images.unsplash.com/photo-1508807526345-15e9b5f4eaff?auto=format&fit=crop&w=1200&q=80',
  'reg-10-turkish-riviera-with-fethiye': 'https://images.unsplash.com/photo-1589556264800-08ae9e129a8c?auto=format&fit=crop&w=1200&q=80',
  'reg-11-antalya': 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=1200&q=80',
  'reg-12-beautiful-turkey': 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1200&q=80',
  'reg-05-b-admirable-turkey-winter': 'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=1200&q=80',
  'reg-13-extension-7-churches': 'https://images.unsplash.com/photo-1527838832700-5059252407fa?auto=format&fit=crop&w=1200&q=80',
  'reg-14-secret-of-the-temple': 'https://images.unsplash.com/photo-1570939274717-7eda259b50ed?auto=format&fit=crop&w=1200&q=80',

  // Dubai / UAE
  'reg-22-stop-over-dubai': 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80',
  'reg-23-dubai-and-its-history': 'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=1200&q=80',
  'reg-24-dubai-city-of-the-future': 'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?auto=format&fit=crop&w=1200&q=80',
  'reg-25-dubai-and-abu-dhabi': 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80',
  'reg-26-dubai-with-overnight-in-abu-dhabi': 'https://images.unsplash.com/photo-1546412414-e1885259563a?auto=format&fit=crop&w=1200&q=80',
  'reg-27-one-week-in-dubai': 'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?auto=format&fit=crop&w=1200&q=80',
  'reg-28-the-complete-emirates': 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80',
  'hm001-honeymoon-in-dubai': 'https://images.unsplash.com/photo-1526495124232-a04e1849168c?auto=format&fit=crop&w=1200&q=80',
  'hm002-honeymoon-in-dubai-with-dinner-at-burj-al-arab': 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80',

  // Jordan
  'reg-15-classic-jordan': 'https://images.unsplash.com/photo-1579606032834-0d33e5c9a1a4?auto=format&fit=crop&w=1200&q=80',
  'reg-16-jordan-with-desert': 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=80',
  'reg-17-jordan-with-desert-and-dead-sea': 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=1200&q=80',
  'reg-18-complete-jordan': 'https://images.unsplash.com/photo-1579606032834-0d33e5c9a1a4?auto=format&fit=crop&w=1200&q=80',
  'reg-19-jordan-red-sea': 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=80',
  'reg-20-jordan-extension-5-days': 'https://images.unsplash.com/photo-1579606032834-0d33e5c9a1a4?auto=format&fit=crop&w=1200&q=80',
  'reg-21-jordan-extension-4-days': 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=1200&q=80',

  // Egypt
  'reg-29-sharm-el-sheikh': 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80',
  'hurghada-escape': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  'sharm-el-sheikh-escape': 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80',
  'journey-of-the-holy-family-10-days': 'https://images.unsplash.com/photo-1568322445389-f64ac2515020?auto=format&fit=crop&w=1200&q=80',
};

const COUNTRY_DEFAULT_IMAGES = {
  'morocco': 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?auto=format&fit=crop&w=1200&q=80',
  'turkey': 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1200&q=80',
  'united arab emirates': 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80',
  'dubai': 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80',
  'jordan': 'https://images.unsplash.com/photo-1579606032834-0d33e5c9a1a4?auto=format&fit=crop&w=1200&q=80',
  'egypt': 'https://images.unsplash.com/photo-1568322445389-f64ac2515020?auto=format&fit=crop&w=1200&q=80',
  'greece': 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80',
  'tunisia': 'https://images.unsplash.com/photo-1583037189850-1921ae7c6c22?auto=format&fit=crop&w=1200&q=80',
  'multi-country': 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80',
};

async function seedAllTourImages() {
  console.log('Fetching all active tours from DB...');
  const tours = await prisma.tour.findMany({
    where: { deletedAt: null },
    include: { images: true },
  });

  console.log(`Found ${tours.length} tours in database.`);
  let updatedCount = 0;

  for (const tour of tours) {
    if (tour.images.length === 0) {
      const explicitImg = TOUR_COVER_IMAGES[tour.slug];
      const countryKey = (tour.country || tour.destinationSlug || '').toLowerCase();
      const fallbackImg = explicitImg || COUNTRY_DEFAULT_IMAGES[countryKey] || COUNTRY_DEFAULT_IMAGES['egypt'];

      await prisma.tourImage.create({
        data: {
          tourId: tour.id,
          imageUrl: fallbackImg,
          sortOrder: 1,
          isHero: true,
        },
      });
      console.log(`✅ Added cover image for tour: ${tour.slug} (${tour.country})`);
      updatedCount++;
    } else {
      // Ensure at least one image has isHero = true
      const hasHero = tour.images.some(img => img.isHero);
      if (!hasHero && tour.images.length > 0) {
        await prisma.tourImage.update({
          where: { id: tour.images[0].id },
          data: { isHero: true },
        });
        console.log(`✅ Marked first image as isHero for tour: ${tour.slug}`);
        updatedCount++;
      }
    }
  }

  console.log(`Finished! Updated cover images for ${updatedCount} tours.`);
}

seedAllTourImages()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
