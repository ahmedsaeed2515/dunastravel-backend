import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL environment variable is required.');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔄 Setting isVerified=true for all users in database...');
  const result = await prisma.user.updateMany({
    data: {
      isVerified: true,
    },
  });
  console.log(`✅ Successfully updated ${result.count} user accounts to isVerified=true!`);
}

main()
  .catch((e) => {
    console.error('❌ Error updating users:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
