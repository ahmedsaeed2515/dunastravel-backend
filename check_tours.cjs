const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tours = await prisma.tour.findMany({
    select: {
      id: true,
      slug: true,
      titleJsonb: true,
      destinationSlug: true,
      country: true,
      status: true,
      isActive: true,
    },
  });
  console.log('Total tours in DB:', tours.length);
  const turkeyTours = tours.filter(t => 
    t.destinationSlug?.toLowerCase() === 'turkey' || 
    t.country?.toLowerCase() === 'turkey' ||
    t.slug?.toLowerCase().includes('turk') ||
    t.slug?.toLowerCase().includes('istanbul') ||
    t.slug?.toLowerCase().includes('cappadocia')
  );
  console.log('Turkey tours in DB:', turkeyTours.length);
  console.log(JSON.stringify(turkeyTours, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
