import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@127.0.0.1:5432/dunastravel_db';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
/*
  await prisma.booking.create({
    data: {
      referenceCode: 'BKG-1',
      customerName: 'Test',
      customerEmail: 'test@test.com',
      status: 'PENDING',
      totalAmount: 1000,
      currency: 'USD',
      bookingDate: new Date(),
      adults: 2,
      children: 0,
      infants: 0
    }
  }).catch(() => {});
*/

  await prisma.company.create({
    data: {
      referenceCode: 'COMP-1',
      name: 'Test Agency'
    }
  }).catch(() => {});

/*
  await prisma.tailorMadeInquiry.create({
    data: {
      referenceCode: 'INQ-1',
      fullName: 'Test',
      email: 'test@test.com',
      startDate: new Date(),
      endDate: new Date()
    }
  }).catch(() => {});
*/

  console.log('Test data seeded!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
