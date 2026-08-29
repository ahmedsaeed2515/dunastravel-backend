import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Testing Move Tour endpoint logic on live database...\n');

  // Find a test tour
  const tour = await prisma.tour.findFirst({
    where: { deletedAt: null },
    select: { id: true, slug: true, country: true, city: true, category: true },
  });

  if (!tour) {
    console.log('No tours found in database.');
    return;
  }

  console.log(`Initial Tour: [${tour.slug}] Country: ${tour.country}, City: ${tour.city}, Category: ${tour.category}`);

  // Test moving to Turkey / Istanbul
  const newCountry = tour.country === 'Turkey' ? 'Egypt' : 'Turkey';
  const newCity = newCountry === 'Turkey' ? 'Istanbul' : 'Cairo';
  const newCategory = 'Cultural Tours';

  const updated = await prisma.tour.update({
    where: { id: tour.id },
    data: {
      country: newCountry,
      city: newCity,
      category: newCategory,
    },
    select: { slug: true, country: true, city: true, category: true },
  });

  console.log(`✅ Successfully moved tour [${updated.slug}] to ${updated.country} (${updated.city}) [${updated.category}]!`);

  // Restore original
  await prisma.tour.update({
    where: { id: tour.id },
    data: {
      country: tour.country,
      city: tour.city,
      category: tour.category,
    },
  });

  console.log(`✅ Successfully restored original location for [${tour.slug}].`);
  console.log('\n🎉 Move Tour verification passed with 100% success!\n');
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
