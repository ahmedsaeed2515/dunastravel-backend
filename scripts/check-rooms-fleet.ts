import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_7ySL8IBrJYwN@ep-cool-sea-atufhdxz-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as any;

async function checkRoomsAndFleet() {
  console.log('=== CHECKING HOTEL ROOMS ===');
  const rooms = await prisma.hotelRoom.findMany({
    include: { hotel: true }
  });
  console.log(`Hotel Rooms: ${rooms.length}`);
  rooms.forEach((r: any) => {
    console.log(` - [Hotel: ${r.hotel?.slug}] Room: ${r.name} -> ratePerNight: $${r.ratePerNight}`);
  });

  console.log('\n=== CHECKING TRANSPORTATION SERVICES ===');
  const fleet = await prisma.transportationService.findMany();
  console.log(`Transportation Services: ${fleet.length}`);
  fleet.forEach((f: any) => {
    console.log(` - [${f.slug || f.name}] Vehicle: ${f.vehicleModel || f.name} -> basePriceUsd: $${f.basePriceUsd}`);
  });
}

checkRoomsAndFleet().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
