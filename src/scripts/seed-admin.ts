import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:password@127.0.0.1:5432/dunastravel_db';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@dunastravel.com' },
    update: { passwordHash, role: 'ADMIN' },
    create: {
      email: 'admin@dunastravel.com',
      passwordHash,
      name: 'Admin User',
      role: 'ADMIN',
      isVerified: true,
      phone: '+1234567890',
    },
  });
  console.log('Admin seeded!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
