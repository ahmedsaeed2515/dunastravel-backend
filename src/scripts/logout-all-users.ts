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

async function logoutAllUsers() {
  console.log(
    'Revoking all user sessions and refresh tokens across the database...',
  );

  const result = await prisma.user.updateMany({
    where: {
      deletedAt: null,
    },
    data: {
      refreshToken: null,
      sessionVersion: { increment: 1 },
    },
  });

  console.log(`Successfully logged out ${result.count} registered accounts.`);
  console.log(
    'All previous JWT access & refresh tokens have been invalidated.',
  );
}

logoutAllUsers()
  .catch((err) => {
    console.error('Error logging out users:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
