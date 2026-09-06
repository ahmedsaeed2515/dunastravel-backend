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

async function resetVerification() {
  console.log('Enforcing email verification across the database...');

  // 1. Ensure systemSetting AUTH_REQUIRE_EMAIL_VERIFICATION is true
  await prisma.systemSetting.upsert({
    where: { key: 'AUTH_REQUIRE_EMAIL_VERIFICATION' },
    update: { value: true },
    create: { key: 'AUTH_REQUIRE_EMAIL_VERIFICATION', value: true },
  });
  console.log('System setting AUTH_REQUIRE_EMAIL_VERIFICATION set to true.');

  // 2. Set isVerified = false for non-admin users so they must verify with 6-digit OTP
  const result = await prisma.user.updateMany({
    where: {
      deletedAt: null,
      role: { not: 'ADMIN' },
    },
    data: {
      isVerified: false,
      verifyToken: null,
      verifyTokenExp: null,
      refreshToken: null,
      sessionVersion: { increment: 1 },
    },
  });

  console.log(`Updated ${result.count} non-admin user accounts to unverified status (isVerified: false).`);
}

resetVerification()
  .catch((err) => {
    console.error('Error resetting user verification status:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
