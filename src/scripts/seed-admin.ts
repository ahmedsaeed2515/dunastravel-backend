import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required.');
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'This development bootstrap script is forbidden in production.',
    );
  }

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password || password.length < 16) {
    throw new Error(
      'BOOTSTRAP_ADMIN_EMAIL and a password of at least 16 characters are required.',
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error(
      'Bootstrap refused: the account already exists and will not be modified.',
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: 'Admin User',
      role: 'ADMIN',
      isVerified: true,
      status: 'ACTIVE',
    },
  });
  console.log('One-time development admin bootstrap completed.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
