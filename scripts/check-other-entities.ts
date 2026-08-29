import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_7ySL8IBrJYwN@ep-cool-sea-atufhdxz-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as any;

async function checkOtherEntities() {
  console.log('=== CHECKING HOTELS ===');
  try {
    const hotels = await prisma.hotel.findMany({
      select: { id: true, slug: true, name: true, city: true, country: true, pricePerNight: true }
    });
    console.log(`Found ${hotels.length} hotels:`);
    hotels.forEach((h: any) => console.log(` - [${h.slug}] ${h.name} (${h.city}, ${h.country}) -> Price/night: $${h.pricePerNight}`));
  } catch (e: any) {
    console.log('Hotels query error or table does not exist:', e.message);
  }

  console.log('\n=== CHECKING TRANSPORTATION FLEET / VEHICLES ===');
  try {
    const vehicles = await prisma.vehicle.findMany({
      select: { id: true, slug: true, name: true, type: true, pricePerDay: true }
    });
    console.log(`Found ${vehicles.length} vehicles:`);
    vehicles.forEach((v: any) => console.log(` - [${v.slug}] ${v.name} -> Price/day: $${v.pricePerDay}`));
  } catch (e: any) {
    console.log('Vehicle query error or table does not exist:', e.message);
  }

  console.log('\n=== CHECKING SERVICES ===');
  try {
    const services = await prisma.service.findMany({
      select: { id: true, slug: true, title: true, basePriceUsd: true }
    });
    console.log(`Found ${services.length} services:`);
    services.forEach((s: any) => console.log(` - [${s.slug}] ${s.title} -> BasePrice: $${s.basePriceUsd}`));
  } catch (e: any) {
    console.log('Service query error or table does not exist:', e.message);
  }
}

checkOtherEntities().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
