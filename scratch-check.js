const path = require('path');
const { PrismaClient } = require(path.join(__dirname, 'node_modules/@prisma/client'));

async function main() {
  const prisma = new PrismaClient();
  try {
    const total = await prisma.tour.count();
    const active = await prisma.tour.count({ where: { isActive: true, status: 'PUBLISHED', deletedAt: null } });
    const sample = await prisma.tour.findMany({ take: 5, select: { id: true, slug: true, country: true, status: true, isActive: true } });
    console.log('DB TOURS SUMMARY:', JSON.stringify({ total, active, sample }, null, 2));
  } catch (err) {
    console.error('Error querying DB:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
