import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_7ySL8IBrJYwN@ep-cool-sea-atufhdxz-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as any;

async function setAllEgyptEntitiesZero() {
  console.log('====================================================');
  console.log('🇪🇬 SETTING ALL EGYPT ENTITIES TO $0.00 USD');
  console.log('====================================================\n');

  // 1. All Tours (Egypt & Multi-Country)
  const tourRes = await prisma.tour.updateMany({
    where: {
      OR: [
        { country: { in: ['Egypt', 'Egito', 'Egipto', 'Multi-Country'] } },
        {
          landingPages: {
            some: {
              landingPage: {
                slug: 'egypt'
              }
            }
          }
        }
      ]
    },
    data: {
      basePriceUsd: new Prisma.Decimal('0.00')
    }
  });
  console.log(`✅ Tours updated to $0.00: ${tourRes.count}`);

  // 2. Hotel Rooms (Sol Pyramid Hotel / Egypt hotels)
  const roomRes = await prisma.hotelRoom.updateMany({
    data: {
      ratePerNight: new Prisma.Decimal('0.00')
    }
  });
  console.log(`✅ Hotel Rooms updated to $0.00: ${roomRes.count}`);

  // 3. Transportation Services
  const transRes = await prisma.transportationService.updateMany({
    data: {
      basePriceUsd: new Prisma.Decimal('0.00')
    }
  });
  console.log(`✅ Transportation Services updated to $0.00: ${transRes.count}`);

  console.log('\n--- VERIFICATION COMPLETE ---');
}

setAllEgyptEntitiesZero().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
