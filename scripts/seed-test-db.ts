import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

const connectionString = 'postgresql://postgres:password@127.0.0.1:5432/dunastravel_test?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seed() {
  console.log('Seeding disposable test database dunastravel_test...');
  
  // 1. Test User
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const user = await prisma.user.upsert({
    where: { email: 'traveler.test@dunastravel.com' },
    update: {
      passwordHash,
      role: 'USER',
      name: 'Test Traveler',
      emailVerifiedAt: new Date(),
    },
    create: {
      id: 'a0000000-0000-0000-0000-000000000001',
      email: 'traveler.test@dunastravel.com',
      passwordHash,
      role: 'USER',
      name: 'Test Traveler',
      emailVerifiedAt: new Date(),
    },
  });
  console.log('Seeded test user:', user.email);

  // 2. Test Admin User
  const admin = await prisma.user.upsert({
    where: { email: 'admin.test@dunastravel.com' },
    update: {
      passwordHash,
      role: 'ADMIN',
      name: 'Admin Test',
      emailVerifiedAt: new Date(),
    },
    create: {
      id: 'a0000000-0000-0000-0000-000000000002',
      email: 'admin.test@dunastravel.com',
      passwordHash,
      role: 'ADMIN',
      name: 'Admin Test',
      emailVerifiedAt: new Date(),
    },
  });
  console.log('Seeded admin user:', admin.email);

  // 3. Tour cairo-express-4d
  const tour = await prisma.tour.upsert({
    where: { slug: 'cairo-express-4d' },
    update: {
      basePriceUsd: 5.00,
      titleJsonb: { en: 'Cairo Express 4D', es: 'El Cairo Express 4D', ar: 'القاهرة السريعة' },
      category: 'Egypt',
      country: 'Egypt',
      city: 'Cairo',
      isActive: true,
    },
    create: {
      id: '98cb34f1-ec69-4ecf-9ebc-c98d72fd66c8',
      slug: 'cairo-express-4d',
      basePriceUsd: 5.00,
      titleJsonb: { en: 'Cairo Express 4D', es: 'El Cairo Express 4D', ar: 'القاهرة السريعة' },
      category: 'Egypt',
      country: 'Egypt',
      city: 'Cairo',
      durationJsonb: { en: '4 Days / 3 Nights' },
      overviewJsonb: { en: 'Cairo Express Tour' },
      isActive: true,
    },
  });
  console.log('Seeded tour:', tour.slug, tour.id);

  // 4. Availability slot 70e66fa4-05bc-41e8-a7d3-77a4c09d6b92
  const slot = await prisma.tourAvailability.upsert({
    where: { id: '70e66fa4-05bc-41e8-a7d3-77a4c09d6b92' },
    update: {
      tourId: tour.id,
      date: new Date('2026-09-14T00:00:00.000Z'),
      totalCapacity: 50,
      remainingSeats: 50,
      status: 'AVAILABLE',
    },
    create: {
      id: '70e66fa4-05bc-41e8-a7d3-77a4c09d6b92',
      tourId: tour.id,
      date: new Date('2026-09-14T00:00:00.000Z'),
      totalCapacity: 50,
      remainingSeats: 50,
      status: 'AVAILABLE',
    },
  });
  console.log('Seeded availability slot:', slot.id);

  console.log('Test database seed complete!');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
