import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function check() {
  const settings = await prisma.systemSetting.findMany();
  console.log('System settings in DB:', JSON.stringify(settings, null, 2));

  // Upsert AUTH_REQUIRE_EMAIL_VERIFICATION = true
  const upserted = await prisma.systemSetting.upsert({
    where: { key: 'AUTH_REQUIRE_EMAIL_VERIFICATION' },
    update: { value: true },
    create: { key: 'AUTH_REQUIRE_EMAIL_VERIFICATION', value: true },
  });
  console.log('Updated AUTH_REQUIRE_EMAIL_VERIFICATION in DB:', upserted);
}

check()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
